import {
  Bookmark,
  Check,
  Hammer,
  Link,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Ruler,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  FloatingIconButton,
  HangTimeAppIcon,
  RoomPlanAppIcon,
  ToolAppSwitcher,
  ToolPanel,
  ToolPanelActionBar,
  ToolPanelActionButton,
  ToolPanelHeader,
  ToolPanelHeaderButton,
  ToolPanelTitle,
  ToolLinkButton,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@canvas-tools/ui";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { GalleryExamples } from "@/components/gallery-examples";
import { HowToHang } from "@/components/how-to-hang";
import { Measurements } from "@/components/measurements";
import { SaveLayoutDialog } from "@/components/save-layout-dialog";
import { SavedLayoutsDialog } from "@/components/saved-layouts-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UseCalculatorReturn } from "@/hooks/use-calculator";
import { useSavedLayouts } from "@/hooks/use-saved-layouts";
import { cn } from "@/lib/utils";
import { Furniture } from "./furniture";
import { GalleryFrames } from "./gallery-frames";
import { HangingHardware } from "./hanging-hardware";
import { HorizontalPosition } from "./horizontal-position";
import { VerticalPosition } from "./vertical-position";
import { WallDimensions } from "./wall-dimensions";

export const ROOM_PLAN_URL = "https://room-plan.app";

export function OpenRoomPlanLink({
  className,
  iconOnly,
  tooltipLabel,
}: {
  className?: string;
  iconOnly?: boolean;
  tooltipLabel?: string;
}) {
  return (
    <ToolLinkButton
      className={className}
      href={ROOM_PLAN_URL}
      iconOnly={iconOnly}
      label="Open Room Plan"
      tooltipLabel={tooltipLabel}
    />
  );
}

interface SidebarProps {
  calculator: UseCalculatorReturn;
}

export function Sidebar({ calculator }: SidebarProps) {
  const { state } = calculator;
  const {
    layouts,
    save,
    update,
    rename,
    remove,
    load,
    startFresh,
    isNameTaken,
    existingLayoutForCurrentConfig,
    loadedLayout,
    hasUnsavedChanges,
  } = useSavedLayouts();
  const [copied, setCopied] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState(false);
  const [bookmarkEditValue, setBookmarkEditValue] = useState("");
  const [bookmarkEditError, setBookmarkEditError] = useState<string | null>(
    null,
  );
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);
  const [isMinimized, setIsMinimized] = useState(
    () => window.innerWidth < 1024,
  );
  const bookmarkInputRef = useRef<HTMLInputElement>(null);

  const currentLayout = existingLayoutForCurrentConfig || loadedLayout;

  const startBookmarkEdit = () => {
    if (!currentLayout) return;
    setEditingBookmark(true);
    setBookmarkEditValue(currentLayout.title);
    setBookmarkEditError(null);
    setTimeout(() => bookmarkInputRef.current?.focus(), 0);
  };

  const cancelBookmarkEdit = () => {
    setEditingBookmark(false);
    setBookmarkEditValue("");
    setBookmarkEditError(null);
  };

  const saveBookmarkEdit = () => {
    if (!currentLayout) return;
    const result = rename(currentLayout.id, bookmarkEditValue);
    if (result.success) {
      setEditingBookmark(false);
      setBookmarkEditValue("");
      setBookmarkEditError(null);
    } else {
      setBookmarkEditError(result.error || "Failed to rename");
    }
  };

  const handleBookmarkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      saveBookmarkEdit();
    } else if (e.key === "Escape") {
      cancelBookmarkEdit();
    }
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNewLayout = () => {
    const hasActiveLayoutState = window.location.search.length > 0;
    if (hasActiveLayoutState) {
      const shouldStartFresh = window.confirm(
        "Start a new layout? This will discard the current layout and any unsaved changes.",
      );
      if (!shouldStartFresh) {
        return;
      }
    }

    startFresh();

    if (hasActiveLayoutState) {
      window.history.pushState({}, "", window.location.pathname);
      window.location.reload();
    }
  };

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isMobile) {
      setIsMinimized(false);
    }
  }, [isMobile]);

  return (
    <div
      className={cn(
        "fixed z-50 pointer-events-none",
        isMobile
          ? "top-2 right-2 bottom-2 left-2"
          : "top-4 left-4 bottom-4 w-[340px]",
      )}
    >
      {/* Minimized toggle button - always in DOM, fades in/out */}
      <motion.div
        className="absolute top-0 left-0 z-10"
        initial={false}
        animate={{
          opacity: isMinimized ? 1 : 0,
          scale: isMinimized ? 1 : 0.8,
        }}
        transition={{ duration: 0.2 }}
        style={{ pointerEvents: isMinimized ? "auto" : "none" }}
      >
        <FloatingIconButton
          onClick={() => setIsMinimized(false)}
          title="Show controls"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </FloatingIconButton>
      </motion.div>

      {/* Main panel - always in DOM, animates size */}
      <motion.div
        className="h-full origin-top-left"
        initial={false}
        animate={{
          opacity: isMinimized ? 0 : 1,
          scale: isMinimized ? (isMobile ? 0.98 : 0.14) : 1,
          y: isMinimized && isMobile ? 40 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 500,
          damping: 35,
          opacity: { duration: 0.15 },
        }}
        style={{ pointerEvents: isMinimized ? "none" : "auto" }}
      >
        <ToolPanel className="flex h-full flex-col overflow-hidden">
          <ToolPanelHeader>
            <ToolPanelTitle
              content={
                <ToolAppSwitcher
                  currentIcon={<HangTimeAppIcon className="h-4.5 w-4.5" />}
                  currentIconClassName="bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-600"
                  currentTitle="Hang Time"
                  currentSubtitle="Pixel Perfect Picture Placement"
                  items={[
                    {
                      href: ROOM_PLAN_URL,
                      icon: <RoomPlanAppIcon className="h-4 w-4 text-white" />,
                      iconClassName:
                        "bg-gradient-to-br from-indigo-500 to-violet-600",
                      title: "Room Plan",
                      subtitle: "Room layout studio",
                    },
                  ]}
                />
              }
              title="Hang Time"
              subtitle="Pixel Perfect Picture Placement"
              actions={
                <ToolPanelHeaderButton
                  onClick={() => setIsMinimized(true)}
                  title="Hide sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </ToolPanelHeaderButton>
              }
            />

            {currentLayout && (
              <div
                className={cn(
                  "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm",
                  hasUnsavedChanges
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                    : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300",
                )}
              >
                <Bookmark
                  className={cn(
                    "size-3.5 flex-shrink-0",
                    hasUnsavedChanges ? "" : "fill-current",
                  )}
                />
                {editingBookmark ? (
                  <div className="flex min-w-0 flex-1 items-center gap-1">
                    <Input
                      ref={bookmarkInputRef}
                      value={bookmarkEditValue}
                      onChange={(e) => {
                        setBookmarkEditValue(e.target.value);
                        setBookmarkEditError(null);
                      }}
                      onKeyDown={handleBookmarkKeyDown}
                      className={cn(
                        "h-6 min-w-0 flex-1 border-gray-300 bg-white text-sm text-gray-900 dark:border-white/20 dark:bg-white/10 dark:text-white",
                        bookmarkEditError && "border-red-500",
                      )}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-6 p-0 text-green-600 hover:bg-green-100 hover:text-green-700 dark:text-green-400 dark:hover:bg-green-500/20 dark:hover:text-green-300"
                      onClick={saveBookmarkEdit}
                    >
                      <Check className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-6 p-0 text-gray-400 hover:text-gray-600 dark:text-white/40 dark:hover:text-white/60"
                      onClick={cancelBookmarkEdit}
                    >
                      <X className="size-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 truncate text-sm">
                      {currentLayout.title}
                      {hasUnsavedChanges && (
                        <span className="text-amber-600 dark:text-amber-400">
                          {" "}
                          *
                        </span>
                      )}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-6 flex-shrink-0 p-0 text-current opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                      onClick={startBookmarkEdit}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="size-6 flex-shrink-0 p-0 text-current opacity-60 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                      onClick={() => startFresh()}
                    >
                      <X className="size-3" />
                    </Button>
                  </>
                )}
              </div>
            )}
          </ToolPanelHeader>

          <ToolPanelActionBar>
            <TooltipProvider delayDuration={200}>
              <div className="flex flex-wrap gap-2">
                <SavedLayoutsDialog
                  layouts={layouts}
                  onLoad={load}
                  onDelete={remove}
                  onRename={rename}
                  iconOnly
                  tooltipLabel="Browse Layouts"
                  buttonClassName="bg-white/80 dark:bg-slate-900/60"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToolPanelActionButton
                      onClick={handleNewLayout}
                      aria-label="New Layout"
                    >
                      <Plus className="h-4 w-4" />
                    </ToolPanelActionButton>
                  </TooltipTrigger>
                  <TooltipContent>New Layout</TooltipContent>
                </Tooltip>
                <SaveLayoutDialog
                  onSave={save}
                  onUpdate={update}
                  isNameTaken={isNameTaken}
                  existingLayoutForCurrentConfig={
                    existingLayoutForCurrentConfig
                  }
                  loadedLayout={loadedLayout}
                  hasUnsavedChanges={hasUnsavedChanges}
                  iconOnly
                  tooltipLabel="Save Layout"
                  buttonClassName="bg-white/80 dark:bg-slate-900/60"
                />
                <GalleryExamples
                  calculator={calculator}
                  iconOnly
                  tooltipLabel="Examples"
                  buttonClassName="bg-white/80 dark:bg-slate-900/60"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <ToolPanelActionButton
                      onClick={handleCopyLink}
                      aria-label={copied ? "Copied" : "Copy link"}
                    >
                      {copied ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Link className="h-4 w-4" />
                      )}
                    </ToolPanelActionButton>
                  </TooltipTrigger>
                  <TooltipContent>
                    {copied ? "Copied" : "Copy link"}
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </ToolPanelActionBar>

          <Tabs
            defaultValue="config"
            className="flex flex-1 flex-col overflow-hidden"
          >
            <TabsList className="h-auto w-full rounded-none border-b border-gray-200 bg-transparent p-0 dark:border-white/10">
              <TabsTrigger
                value="config"
                className="flex-1 rounded-none border-0 py-2.5 text-xs font-medium text-gray-500 shadow-none hover:bg-gray-50 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white/70 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900 data-[state=active]:shadow-none dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
              >
                <SlidersHorizontal className="size-3" />
                Configure
              </TabsTrigger>
              <TabsTrigger
                value="measurements"
                className="flex-1 rounded-none border-0 py-2.5 text-xs font-medium text-gray-500 shadow-none hover:bg-gray-50 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white/70 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900 data-[state=active]:shadow-none dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
              >
                <Ruler className="size-3" />
                Measure
              </TabsTrigger>
              <TabsTrigger
                value="howto"
                className="flex-1 rounded-none border-0 py-2.5 text-xs font-medium text-gray-500 shadow-none hover:bg-gray-50 hover:text-gray-700 dark:text-white/50 dark:hover:bg-white/5 dark:hover:text-white/70 data-[state=active]:bg-gray-100 data-[state=active]:text-gray-900 data-[state=active]:shadow-none dark:data-[state=active]:bg-white/10 dark:data-[state=active]:text-white"
              >
                <Hammer className="size-3" />
                Hang
              </TabsTrigger>
            </TabsList>

            <TabsContent value="config" className="mt-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-0 p-4">
                  <WallDimensions calculator={calculator} />
                  <GalleryFrames calculator={calculator} />
                  <HangingHardware calculator={calculator} />
                  <VerticalPosition calculator={calculator} />
                  {state.anchorType === "furniture" && (
                    <Furniture calculator={calculator} />
                  )}
                  {state.anchorType !== "furniture" && (
                    <HorizontalPosition calculator={calculator} />
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="measurements"
              className="mt-0 flex-1 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <div className="p-4">
                  <Measurements calculator={calculator} />
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="howto" className="mt-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  <HowToHang calculator={calculator} />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </ToolPanel>
      </motion.div>
    </div>
  );
}
