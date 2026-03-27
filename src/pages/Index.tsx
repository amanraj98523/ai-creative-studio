import { useMemo, useState } from "react";
import { Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type WorkflowStatus = "idle" | "analyzing" | "awaiting_approval" | "generating" | "success" | "error";
type ImageMode = "variations" | "similar";

type EnhancedPromptResponse = {
  tone: string;
  intent: string;
  requirements: string[];
  enhancedPrompt: string;
  reasoning: string;
};

type ImageAnalysisResponse = {
  caption: string;
  tags: string[];
  style: string;
  theme: string;
  promptUsed: string;
  images: string[];
};

type PromptImageResponse = {
  images: string[];
  promptUsed: string;
};

type HistoryItem = {
  id: string;
  type: "text" | "image";
  title: string;
  subtitle: string;
  prompt: string;
  images: string[];
};

const MAX_UPLOAD_MB = 8;

const fileToDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read the image file."));
    reader.readAsDataURL(file);
  });

const Index = () => {
  const { toast } = useToast();

  const [textStatus, setTextStatus] = useState<WorkflowStatus>("idle");
  const [rawPrompt, setRawPrompt] = useState("");
  const [tone, setTone] = useState("");
  const [intent, setIntent] = useState("");
  const [requirements, setRequirements] = useState<string[]>([]);
  const [enhancedPrompt, setEnhancedPrompt] = useState("");
  const [enhancementReason, setEnhancementReason] = useState("");
  const [textImages, setTextImages] = useState<string[]>([]);

  const [imageStatus, setImageStatus] = useState<WorkflowStatus>("idle");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageMode, setImageMode] = useState<ImageMode>("variations");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [style, setStyle] = useState("");
  const [theme, setTheme] = useState("");
  const [imagePromptUsed, setImagePromptUsed] = useState("");
  const [imageGenerated, setImageGenerated] = useState<string[]>([]);

  const [history, setHistory] = useState<HistoryItem[]>([]);

  const statusLabel = (status: WorkflowStatus) => {
    if (status === "idle") return "Idle";
    if (status === "analyzing") return "Analyzing";
    if (status === "awaiting_approval") return "Awaiting approval";
    if (status === "generating") return "Generating";
    if (status === "success") return "Success";
    return "Error";
  };

  const addToHistory = (item: Omit<HistoryItem, "id">) => {
    setHistory((prev) => [{ ...item, id: crypto.randomUUID() }, ...prev].slice(0, 8));
  };

  const parseFunctionError = async (error: unknown) => {
    const fallback = "Request failed. Please try again.";
    if (!error || typeof error !== "object") return fallback;
    const functionError = error as { message?: string; context?: { json?: () => Promise<{ error?: string }> } };

    if (functionError.context?.json) {
      try {
        const body = await functionError.context.json();
        if (body?.error) return body.error;
      } catch {
        return functionError.message ?? fallback;
      }
    }

    return functionError.message ?? fallback;
  };

  const handleEnhancePrompt = async () => {
    const trimmed = rawPrompt.trim();
    if (trimmed.length < 5 || trimmed.length > 1000) {
      toast({
        title: "Invalid prompt",
        description: "Enter a prompt between 5 and 1000 characters.",
        variant: "destructive",
      });
      return;
    }

    setTextStatus("analyzing");
    setTextImages([]);

    try {
      const { data, error } = await supabase.functions.invoke<EnhancedPromptResponse>("enhance-prompt", {
        body: { prompt: trimmed },
      });
      if (error) throw error;
      if (!data) throw new Error("No enhancement response received.");

      setTone(data.tone);
      setIntent(data.intent);
      setRequirements(data.requirements);
      setEnhancedPrompt(data.enhancedPrompt);
      setEnhancementReason(data.reasoning);
      setTextStatus("awaiting_approval");
    } catch (error) {
      setTextStatus("error");
      toast({
        title: "Enhancement failed",
        description: await parseFunctionError(error),
        variant: "destructive",
      });
    }
  };

  const handleGenerateFromPrompt = async () => {
    const prompt = enhancedPrompt.trim();
    if (prompt.length < 5 || prompt.length > 1000) {
      toast({
        title: "Invalid enhanced prompt",
        description: "The enhanced prompt must be between 5 and 1000 characters.",
        variant: "destructive",
      });
      return;
    }

    setTextStatus("generating");
    try {
      const { data, error } = await supabase.functions.invoke<PromptImageResponse>("generate-from-prompt", {
        body: { prompt, count: 2 },
      });
      if (error) throw error;
      if (!data?.images?.length) throw new Error("No images were generated.");

      setTextImages(data.images);
      setTextStatus("success");
      addToHistory({
        type: "text",
        title: "Text workflow run",
        subtitle: `${tone || "Balanced"} tone • ${intent || "General"}`,
        prompt: data.promptUsed,
        images: data.images,
      });

      toast({ title: "Images generated", description: "Your text workflow completed successfully." });
    } catch (error) {
      setTextStatus("error");
      toast({
        title: "Generation failed",
        description: await parseFunctionError(error),
        variant: "destructive",
      });
    }
  };

  const validateImageInput = () => {
    if (!imageFile && !imageUrl.trim()) {
      throw new Error("Upload an image file or provide an image URL.");
    }

    if (imageFile) {
      const validTypes = ["image/png", "image/jpeg", "image/webp"];
      if (!validTypes.includes(imageFile.type)) {
        throw new Error("Only PNG, JPEG, and WEBP files are supported.");
      }
      if (imageFile.size > MAX_UPLOAD_MB * 1024 * 1024) {
        throw new Error(`Image must be smaller than ${MAX_UPLOAD_MB}MB.`);
      }
    }

    if (imageUrl.trim()) {
      const isValidUrl = /^https?:\/\/.+/i.test(imageUrl.trim());
      if (!isValidUrl) {
        throw new Error("Image URL must start with http:// or https://");
      }
    }
  };

  const handleAnalyzeImage = async () => {
    try {
      validateImageInput();
    } catch (error) {
      toast({
        title: "Invalid image input",
        description: error instanceof Error ? error.message : "Please provide a valid image input.",
        variant: "destructive",
      });
      return;
    }

    setImageStatus("analyzing");
    setImageGenerated([]);

    try {
      const imageDataUrl = imageFile ? await fileToDataUrl(imageFile) : undefined;
      const { data, error } = await supabase.functions.invoke<ImageAnalysisResponse>("analyze-image", {
        body: {
          imageDataUrl,
          imageUrl: imageUrl.trim() || undefined,
          mode: imageMode,
          count: 2,
        },
      });
      if (error) throw error;
      if (!data) throw new Error("No analysis response received.");

      setCaption(data.caption);
      setTags(data.tags);
      setStyle(data.style);
      setTheme(data.theme);
      setImagePromptUsed(data.promptUsed);
      setImageGenerated(data.images);
      setImageStatus("success");

      addToHistory({
        type: "image",
        title: "Image workflow run",
        subtitle: `${data.style} • ${imageMode === "variations" ? "Variations" : "Similar images"}`,
        prompt: data.promptUsed,
        images: data.images,
      });

      toast({ title: "Image workflow complete", description: "Analysis and image generation finished." });
    } catch (error) {
      setImageStatus("error");
      toast({
        title: "Image workflow failed",
        description: await parseFunctionError(error),
        variant: "destructive",
      });
    }
  };

  const overallHistoryCount = useMemo(() => history.length, [history.length]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-secondary/40 blur-3xl" />
      </div>

      <div className="container relative py-8 md:py-10">
        <header className="mb-8 overflow-hidden rounded-2xl border bg-card/80 p-6 shadow-sm backdrop-blur md:p-8">
          <div className="grid gap-4 md:grid-cols-[1.3fr_auto] md:items-end">
            <div className="grid gap-3">
              <Badge variant="secondary" className="w-fit">Assignment Prototype</Badge>
              <h1 className="text-3xl font-bold leading-tight tracking-tight md:text-5xl">Prompt-to-Image Studio</h1>
              <p className="max-w-2xl text-sm text-muted-foreground md:text-base">
                Build and demo both required flows in one screen: text enhancement to image generation, plus image analysis to
                variations or similar outputs.
              </p>
            </div>
            <div className="grid gap-2 rounded-xl border bg-muted/40 p-4 text-sm md:min-w-56">
              <span className="font-medium">Ready for demo</span>
              <span className="text-muted-foreground">Two workflows · Validation · Run history</span>
            </div>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
          <Tabs defaultValue="text" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="text" className="gap-2"><Sparkles className="h-4 w-4" /> Text Workflow</TabsTrigger>
              <TabsTrigger value="image" className="gap-2"><Upload className="h-4 w-4" /> Image Workflow</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-4">
              <Card className="border-border/80 bg-card/90 shadow-sm backdrop-blur">
                <CardHeader>
                  <CardTitle>Text → Enhance → Approve → Generate</CardTitle>
                  <CardDescription>Analyze tone/intent, improve prompt quality, then generate images.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Raw prompt</label>
                    <Textarea
                      value={rawPrompt}
                      onChange={(e) => setRawPrompt(e.target.value)}
                      placeholder="Describe your idea..."
                      className="min-h-[120px]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={handleEnhancePrompt} disabled={textStatus === "analyzing" || textStatus === "generating"}>
                      {textStatus === "analyzing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Enhance prompt
                    </Button>
                    <Button variant="secondary" onClick={handleGenerateFromPrompt} disabled={textStatus !== "awaiting_approval" && textStatus !== "success"}>
                      {textStatus === "generating" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Approve & generate
                    </Button>
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-4">
                    <p className="mb-2 text-sm text-muted-foreground">Status: {statusLabel(textStatus)}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p className="text-sm"><span className="font-medium">Tone:</span> {tone || "—"}</p>
                      <p className="text-sm"><span className="font-medium">Intent:</span> {intent || "—"}</p>
                    </div>
                    {requirements.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {requirements.map((item) => (
                          <Badge key={item} variant="outline">{item}</Badge>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 space-y-2">
                      <label className="text-sm font-medium">Enhanced prompt (editable)</label>
                      <Textarea value={enhancedPrompt} onChange={(e) => setEnhancedPrompt(e.target.value)} className="min-h-[100px]" />
                    </div>
                    {enhancementReason && <p className="mt-2 text-sm text-muted-foreground">{enhancementReason}</p>}
                  </div>

                  {textImages.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {textImages.map((src, index) => (
                        <Card key={`${src}-${index}`} className="overflow-hidden border-border/70 bg-card/95 shadow-sm transition hover:shadow-md">
                          <CardContent className="space-y-3 p-3">
                            <img src={src} alt={`Generated text workflow result ${index + 1}`} className="aspect-square w-full rounded-md object-cover" loading="lazy" />
                            <div className="flex gap-2">
                              <Button asChild size="sm" variant="outline" className="flex-1">
                                <a href={src} download={`text-workflow-${index + 1}.png`}>Download</a>
                              </Button>
                              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setRawPrompt(enhancedPrompt)}>
                                Use as next input
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="image" className="mt-4">
              <Card className="border-border/80 bg-card/90 shadow-sm backdrop-blur">
                <CardHeader>
                  <CardTitle>Image → Analyze → Generate</CardTitle>
                  <CardDescription>Upload local/external image, detect style and tags, then create results.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Upload image</label>
                      <Input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => {
                          const nextFile = e.target.files?.[0] ?? null;
                          setImageFile(nextFile);
                          setImagePreview(nextFile ? URL.createObjectURL(nextFile) : "");
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">or image URL</label>
                      <Input
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://example.com/image.jpg"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Generation mode</label>
                    <div className="flex gap-2">
                      <Button variant={imageMode === "variations" ? "default" : "outline"} onClick={() => setImageMode("variations")}>
                        Variations
                      </Button>
                      <Button variant={imageMode === "similar" ? "default" : "outline"} onClick={() => setImageMode("similar")}>
                        Similar new images
                      </Button>
                    </div>
                  </div>

                  <Button onClick={handleAnalyzeImage} disabled={imageStatus === "analyzing" || imageStatus === "generating"}>
                    {imageStatus === "analyzing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Analyze & generate
                  </Button>

                  {(imagePreview || caption || imageGenerated.length > 0) && (
                    <div className="rounded-xl border bg-muted/30 p-4">
                      <p className="mb-2 text-sm text-muted-foreground">Status: {statusLabel(imageStatus)}</p>
                      {imagePreview && <img src={imagePreview} alt="Uploaded source" className="mb-3 h-44 w-full rounded-md object-cover" />}
                      {caption && <p className="text-sm"><span className="font-medium">Caption:</span> {caption}</p>}
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        <p className="text-sm"><span className="font-medium">Style:</span> {style || "—"}</p>
                        <p className="text-sm"><span className="font-medium">Theme:</span> {theme || "—"}</p>
                      </div>
                      {tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tags.map((tag) => (
                            <Badge key={tag} variant="outline">{tag}</Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {imageGenerated.length > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {imageGenerated.map((src, index) => (
                        <Card key={`${src}-${index}`} className="overflow-hidden border-border/70 bg-card/95 shadow-sm transition hover:shadow-md">
                          <CardContent className="space-y-3 p-3">
                            <img src={src} alt={`Generated image workflow result ${index + 1}`} className="aspect-square w-full rounded-md object-cover" loading="lazy" />
                            <div className="flex gap-2">
                              <Button asChild size="sm" variant="outline" className="flex-1">
                                <a href={src} download={`image-workflow-${index + 1}.png`}>Download</a>
                              </Button>
                              <Button size="sm" variant="ghost" className="flex-1" onClick={() => setRawPrompt(imagePromptUsed)}>
                                Use as next input
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <Card className="border-border/80 bg-card/90 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Results context</CardTitle>
                <CardDescription>Reusable prompt metadata and run history.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Saved runs: {overallHistoryCount}</p>
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" className="w-full">View latest generation prompt</Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 rounded-md border bg-muted/40 p-3 text-sm">
                    {imagePromptUsed || enhancedPrompt || "No prompt generated yet."}
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>

            <Card className="border-border/80 bg-card/90 shadow-sm backdrop-blur">
              <CardHeader>
                <CardTitle>Run history</CardTitle>
                <CardDescription>Recent workflow executions for demo playback.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.length === 0 && <p className="text-sm text-muted-foreground">No runs yet.</p>}
                {history.map((item) => (
                  <div key={item.id} className="rounded-lg border bg-muted/20 p-3 transition hover:bg-muted/40">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">{item.title}</p>
                      <Badge variant="secondary">{item.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.prompt}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
};

export default Index;
