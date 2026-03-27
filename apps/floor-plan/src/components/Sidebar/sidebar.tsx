import {
  FloatingIconButton,
  FloorPlanAppIcon,
  HangTimeAppIcon,
  InspectorInset,
  InspectorListRow,
  InspectorOptionCard,
  InspectorSectionHeader,
  InspectorSegmentedControl,
  InspectorSegmentedControlItem,
  SuiteDialogContent,
  ToolAppSwitcher,
  ToolLinkButton,
  ToolPanel,
  ToolPanelActionBar,
  ToolPanelActionButton,
  ToolPanelHeader,
  ToolPanelHeaderButton,
  ToolPanelTitle,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@canvas-tools/ui";
import {
  ChevronDown,
  ChevronsDown,
  ChevronsUp,
  ChevronUp,
  Copy,
  Download,
  FolderOpen,
  History,
  Home,
  Layers,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Redo2,
  RotateCw,
  Sofa,
  Trash2,
  Undo2,
  Unlink,
  Unlock,
  Upload,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SnapshotActionsMenu } from "@/components/ui/snapshot-actions-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  FURNITURE_CATEGORIES,
  FURNITURE_PRESETS,
  PULLOUT_SOFA_DEFAULTS,
} from "@/data/furniture-presets";
import { ROOM_TEMPLATES } from "@/data/room-templates";
import type { RoomPlannerReturn } from "@/hooks/use-floor-planner";
import type { PlannerProjectsReturn } from "@/hooks/use-planner-projects";
import { cn } from "@/lib/utils";
import type {
  FurnitureItem,
  FurniturePreset,
  FurnitureShape,
  PulloutBedSize,
  PulloutSofaState,
  Unit,
  Wall,
  WallFeature,
} from "@/types";
import { ROOM_SHAPE_ICONS } from "./room-shape-icons";

export const HANG_TIME_URL = "https://hang-time.app";

export function OpenHangTimeLink({
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
      href={HANG_TIME_URL}
      iconOnly={iconOnly}
      label="Open Hang Time"
      tooltipLabel={tooltipLabel}
    />
  );
}

interface SidebarProps {
  planner: RoomPlannerReturn;
  projects: PlannerProjectsReturn;
}

type Formatter = RoomPlannerReturn["toDisplay"];
type Parser = RoomPlannerReturn["fromDisplay"];

type RoomSectionPlanner = Pick<RoomPlannerReturn, "applyTemplate">;

type WallsSectionPlanner = Pick<
  RoomPlannerReturn,
  | "addWallFeature"
  | "disconnectEndpoint"
  | "fromDisplay"
  | "removeWall"
  | "removeWallFeature"
  | "room"
  | "selectedWallId"
  | "setSelectedWallId"
  | "setWallLength"
  | "toDisplay"
  | "unit"
  | "updateWall"
  | "updateWallFeature"
>;

type FurnitureSectionPlanner = Pick<
  RoomPlannerReturn,
  | "addFurniture"
  | "duplicateFurniture"
  | "furniture"
  | "fromDisplay"
  | "bringFurnitureToFront"
  | "moveFurnitureBackward"
  | "moveFurnitureForward"
  | "removeFurniture"
  | "rotateFurniture"
  | "sendFurnitureToBack"
  | "setPulloutBedSize"
  | "selectedId"
  | "selectedIds"
  | "setSelectedId"
  | "togglePulloutSofa"
  | "toDisplay"
  | "unit"
  | "updateFurniture"
  | "updatePulloutSofa"
>;

type HistoryDebugPlanner = Pick<
  RoomPlannerReturn,
  "discardFutureHistory" | "historyDebug" | "jumpToHistory" | "returnToLatestHistory"
>;

type ProjectControls = Pick<
  PlannerProjectsReturn,
  | "activeProject"
  | "activeSnapshot"
  | "createProject"
  | "createSnapshot"
  | "deleteProject"
  | "deleteSnapshot"
  | "duplicateProject"
  | "duplicateSnapshot"
  | "exportProject"
  | "importProject"
  | "projects"
  | "renameProject"
  | "renameSnapshot"
  | "selectProject"
  | "selectSnapshot"
>;

const featureMeta = {
  closet: {
    Icon: ClosetIcon,
    accentClass: "text-stone-400",
    cardClass: "border-stone-400/20 bg-stone-400/[0.03]",
    label: "closet",
  },
  door: {
    Icon: DoorIcon,
    accentClass: "text-indigo-500",
    cardClass: "border-indigo-500/20 bg-indigo-500/[0.03]",
    label: "door",
  },
  opening: {
    Icon: OpeningIcon,
    accentClass: "text-emerald-500",
    cardClass: "border-emerald-500/20 bg-emerald-500/[0.03]",
    label: "opening",
  },
  window: {
    Icon: WindowIcon,
    accentClass: "text-sky-500",
    cardClass: "border-sky-500/20 bg-sky-500/[0.03]",
    label: "window",
  },
} as const;

function DoorIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="2" y="2" width="7" height="12" rx="0.5" />
      <circle cx="7.5" cy="8.5" r="0.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WindowIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="2" y="3" width="12" height="10" rx="0.5" />
      <line x1="8" y1="3" x2="8" y2="13" />
      <line x1="2" y1="8" x2="14" y2="8" />
    </svg>
  );
}

function ClosetIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <rect x="2" y="2" width="12" height="12" rx="0.5" />
      <line x1="8" y1="2" x2="8" y2="14" />
      <circle cx="6.5" cy="8" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="8" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

function OpeningIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className={className}
    >
      <path d="M3 13V3" />
      <path d="M13 13V3" />
      <path d="M3 3h10" />
    </svg>
  );
}

function SectionHeader({
  icon: Icon,
  iconColor,
  label,
  onToggle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <InspectorSectionHeader
      onClick={onToggle}
      icon={Icon}
      iconClassName={iconColor}
      label={label}
      variant="inline"
    />
  );
}

function NumberInput({
  label,
  max = 9999,
  min = 0,
  onChange,
  step = 0.125,
  suffix,
  value,
}: {
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  suffix?: string;
  value: number;
}) {
  const formattedValue = value % 1 === 0 ? value.toFixed(0) : Number.parseFloat(value.toFixed(3));
  const [localValue, setLocalValue] = useState<string>(String(formattedValue));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(formattedValue));
    }
  }, [formattedValue, isFocused]);

  const commit = () => {
    const nextValue = Number.parseFloat(localValue);
    if (!Number.isNaN(nextValue)) {
      onChange(clamp(nextValue, min, max));
    } else {
      setLocalValue(String(formattedValue));
    }
    setIsFocused(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-gray-500 dark:text-white/50">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          value={isFocused ? localValue : formattedValue}
          onChange={(event) => setLocalValue(event.target.value)}
          onFocus={() => {
            setIsFocused(true);
            setLocalValue(String(formattedValue));
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              (event.target as HTMLInputElement).blur();
            }
          }}
          min={min}
          max={max}
          step={step}
          className="h-8 pr-8 text-xs"
        />
        {suffix ? (
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-gray-400 dark:text-white/30">
            {suffix}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function SidebarHeader({ onClose }: { onClose: () => void }) {
  return (
    <ToolPanelHeader>
      <ToolPanelTitle
        content={
          <ToolAppSwitcher
            currentIcon={<FloorPlanAppIcon className="h-4 w-4 text-white" />}
            currentIconClassName="bg-gradient-to-br from-indigo-500 to-violet-600"
            currentTitle="Floor Plan"
            currentSubtitle="Room layout studio"
            items={[
              {
                href: HANG_TIME_URL,
                icon: <HangTimeAppIcon className="h-4.5 w-4.5" />,
                iconClassName: "bg-gradient-to-br from-fuchsia-500 via-violet-500 to-indigo-600",
                title: "Hang Time",
                subtitle: "Pixel Perfect Picture Placement",
              },
            ]}
          />
        }
        title="Floor Plan"
        subtitle="Room layout studio"
        actions={
          <ToolPanelHeaderButton onClick={onClose} title="Hide sidebar">
            <PanelLeftClose className="h-3.5 w-3.5" />
          </ToolPanelHeaderButton>
        }
      />
    </ToolPanelHeader>
  );
}

function formatProjectBrowserDate(timestamp: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    }).format(new Date(timestamp));
  } catch {
    return "";
  }
}

function ProjectManagerDialog({
  activeProject,
  exportProject,
  importProject,
  open,
  projects,
  selectProject,
  setOpen,
}: ProjectControls & {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleExportProject = useCallback(() => {
    const exported = exportProject(activeProject.id);
    if (!exported) {
      return;
    }

    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeName = activeProject.name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    link.href = url;
    link.download = `${safeName || "floor-plan-project"}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [activeProject.id, activeProject.name, exportProject]);

  const handleImportFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) {
        return;
      }

      try {
        const raw = await file.text();
        importProject(raw);
        setOpen(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Import failed";
        window.alert(`Unable to import project: ${message}`);
      } finally {
        event.target.value = "";
      }
    },
    [importProject, setOpen],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <SuiteDialogContent className="max-h-[min(80vh,760px)] w-[min(720px,calc(100vw-2rem))] max-w-none overflow-hidden p-0">
        <DialogHeader className="border-b border-gray-200/70 px-6 py-5 dark:border-white/10">
          <DialogTitle className="text-left text-xl text-gray-950 dark:text-white">
            Project Browser
          </DialogTitle>
          <DialogDescription className="text-left text-gray-500 dark:text-white/50">
            Choose a saved project to open.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5">
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={handleImportFile}
          />
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500 dark:text-white/45">
              {projects.length} available {projects.length === 1 ? "project" : "projects"}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-gray-400 dark:text-white/35">
                Current: {activeProject.name}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[11px]"
                onClick={() => importInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Import JSON
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-[11px]"
                onClick={handleExportProject}
              >
                <Download className="h-3.5 w-3.5" />
                Export Current
              </Button>
            </div>
          </div>

          <ScrollArea className="h-[min(60vh,520px)] rounded-2xl border border-gray-200/70 bg-white/70 p-2 dark:border-white/10 dark:bg-slate-950/35">
            <div className="space-y-2">
              {projects.map((project) => {
                const isActive = project.id === activeProject.id;
                const currentSnapshot =
                  project.snapshots.find((snapshot) => snapshot.id === project.activeSnapshotId) ??
                  project.snapshots[0];

                return (
                  <InspectorListRow key={project.id} asChild selected={isActive} tone="cyan">
                    <button
                      type="button"
                      onClick={() => {
                        selectProject(project.id);
                        setOpen(false);
                      }}
                      className="flex w-full items-center justify-between px-1 py-1 text-left"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                          {project.name}
                        </p>
                        <p className="truncate text-[11px] text-gray-500 dark:text-white/45">
                          {currentSnapshot?.name} · {project.snapshots.length}{" "}
                          {project.snapshots.length === 1 ? "snapshot" : "snapshots"}
                        </p>
                      </div>
                      <div className="shrink-0 pl-4 text-right">
                        <p className="text-[11px] text-gray-400 dark:text-white/35">
                          {formatProjectBrowserDate(project.updatedAt)}
                        </p>
                        <p className="mt-1 text-[11px] text-gray-400 dark:text-white/35">
                          {isActive ? "Current" : "Open"}
                        </p>
                      </div>
                    </button>
                  </InspectorListRow>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </SuiteDialogContent>
    </Dialog>
  );
}

function SidebarProjectActions({
  canRedo,
  canUndo,
  onBrowseProjects,
  onCreateProject,
  redo,
  undo,
}: {
  canRedo: boolean;
  canUndo: boolean;
  onBrowseProjects: () => void;
  onCreateProject: () => void;
  redo: () => void;
  undo: () => void;
}) {
  return (
    <ToolPanelActionBar>
      <TooltipProvider delay={200}>
        <div className="flex flex-wrap gap-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <ToolPanelActionButton onClick={onBrowseProjects} aria-label="Browse projects">
                  <FolderOpen className="h-4 w-4" />
                </ToolPanelActionButton>
              }
            />
            <TooltipContent>Browse projects</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToolPanelActionButton onClick={onCreateProject} aria-label="New project">
                  <Plus className="h-4 w-4" />
                </ToolPanelActionButton>
              }
            />
            <TooltipContent>New project</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToolPanelActionButton onClick={undo} disabled={!canUndo} aria-label="Undo">
                  <Undo2 className="h-4 w-4" />
                </ToolPanelActionButton>
              }
            />
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger
              render={
                <ToolPanelActionButton onClick={redo} disabled={!canRedo} aria-label="Redo">
                  <Redo2 className="h-4 w-4" />
                </ToolPanelActionButton>
              }
            />
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </ToolPanelActionBar>
  );
}

function ProjectBrowserSection({
  controls,
  projectBrowserOpen,
  setProjectBrowserOpen,
}: {
  controls: ProjectControls;
  projectBrowserOpen: boolean;
  setProjectBrowserOpen: (open: boolean) => void;
}) {
  const {
    activeProject,
    activeSnapshot,
    createSnapshot,
    deleteSnapshot,
    renameProject,
    renameSnapshot,
    duplicateSnapshot,
    selectSnapshot,
  } = controls;
  const [isOpen, setIsOpen] = useState(false);
  const [projectDraftName, setProjectDraftName] = useState(activeProject.name);
  const [snapshotDraftName, setSnapshotDraftName] = useState(activeSnapshot.name);

  useEffect(() => {
    setProjectDraftName(activeProject.name);
    setSnapshotDraftName(activeSnapshot.name);
  }, [activeProject.name, activeSnapshot.name]);

  const commitProjectRename = useCallback(() => {
    renameProject(activeProject.id, projectDraftName);
  }, [activeProject.id, projectDraftName, renameProject]);

  const commitSnapshotRename = useCallback(() => {
    renameSnapshot(activeProject.id, activeSnapshot.id, snapshotDraftName);
  }, [activeProject.id, activeSnapshot.id, renameSnapshot, snapshotDraftName]);

  return (
    <>
      <ProjectManagerDialog
        {...controls}
        open={projectBrowserOpen}
        setOpen={setProjectBrowserOpen}
      />
      <Collapsible
        open={isOpen}
        onOpenChange={setIsOpen}
        className="border-b border-gray-200 dark:border-white/10"
      >
        <div>
          <InspectorSectionHeader
            icon={Layers}
            iconClassName="text-cyan-500"
            label="Project"
            description={`${activeProject.name} / ${activeSnapshot.name}`}
            variant="inline"
          />

          <CollapsibleContent className="pt-2.5 pb-3">
            <InspectorInset className="space-y-4 border-gray-200/60 bg-gray-50/70">
              <div className="space-y-4">
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 dark:text-white/50">Project name</Label>
                    <Input
                      value={projectDraftName}
                      onChange={(event) => setProjectDraftName(event.target.value)}
                      onBlur={commitProjectRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className="h-8 bg-white/80 text-sm dark:bg-slate-900/70"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500 dark:text-white/50">
                      Snapshot name
                    </Label>
                    <Input
                      value={snapshotDraftName}
                      onChange={(event) => setSnapshotDraftName(event.target.value)}
                      onBlur={commitSnapshotRename}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className="h-8 bg-white/80 text-sm dark:bg-slate-900/70"
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  <Separator className="sm:col-span-2" />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <Label className="text-xs text-gray-500 dark:text-white/50">Snapshots</Label>
                    <span className="text-[11px] text-gray-400 dark:text-white/35">
                      {activeProject.snapshots.length} variations
                    </span>
                  </div>
                  <div className="space-y-2">
                    {activeProject.snapshots.map((snapshot) => {
                      const isActive = snapshot.id === activeSnapshot.id;

                      return (
                        <InspectorListRow
                          key={snapshot.id}
                          selected={isActive}
                          tone="violet"
                          className="flex items-center gap-2"
                        >
                          <button
                            type="button"
                            onClick={() => selectSnapshot(activeProject.id, snapshot.id)}
                            className="flex min-w-0 flex-1 items-center justify-between text-left"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                {snapshot.name}
                              </p>
                              <p className="truncate text-[11px] text-gray-500 dark:text-white/45">
                                Updated {formatProjectBrowserDate(snapshot.updatedAt)}
                              </p>
                            </div>
                            <span className="shrink-0 pl-3 text-[11px] text-gray-400 dark:text-white/35">
                              {isActive ? "Current" : "Open"}
                            </span>
                          </button>

                          <SnapshotActionsMenu
                            onDuplicate={() => duplicateSnapshot(activeProject.id, snapshot.id)}
                            onDelete={() => deleteSnapshot(activeProject.id, snapshot.id)}
                            deleteDisabled={activeProject.snapshots.length === 1}
                          />
                        </InspectorListRow>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full justify-start"
                    onClick={() => createSnapshot(activeProject.id)}
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    New Snapshot
                  </Button>
                </div>
              </div>
            </InspectorInset>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </>
  );
}

function RoomShapeSection({
  open,
  onToggle,
  planner,
}: {
  onToggle: () => void;
  open: boolean;
  planner: RoomSectionPlanner;
}) {
  const { applyTemplate } = planner;

  return (
    <Collapsible open={open} className="border-b border-gray-200 dark:border-white/10">
      <SectionHeader icon={Home} label="Room Shape" iconColor="text-blue-500" onToggle={onToggle} />
      <CollapsibleContent>
        <div className="space-y-3 pt-2.5 pb-3">
          <div>
            <Label className="mb-1.5 text-xs text-gray-500 dark:text-white/50">Templates</Label>
            <div className="grid grid-cols-4 gap-1.5">
              {ROOM_TEMPLATES.map((template) => {
                const ShapeIcon = ROOM_SHAPE_ICONS[template.name];

                return (
                  <InspectorOptionCard
                    key={template.name}
                    asChild
                    layout="column"
                    tone="blue"
                    className="gap-1.5 px-2.5 py-2.5"
                  >
                    <button type="button" onClick={() => applyTemplate(template.vertices)}>
                      {ShapeIcon ? (
                        <ShapeIcon className="h-6 w-6 text-gray-500 dark:text-white/60" />
                      ) : null}
                      <span className="text-center text-[10px] leading-tight text-gray-600 dark:text-white/50">
                        {template.name}
                      </span>
                    </button>
                  </InspectorOptionCard>
                );
              })}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function WallsSection({
  open,
  onToggle,
  planner,
}: {
  onToggle: () => void;
  open: boolean;
  planner: WallsSectionPlanner;
}) {
  const { room, selectedWallId, setSelectedWallId } = planner;

  return (
    <Collapsible open={open} className="border-b border-gray-200 dark:border-white/10">
      <SectionHeader
        icon={Layers}
        label={`Walls (${room.walls.length})`}
        iconColor="text-cyan-500"
        onToggle={onToggle}
      />
      <CollapsibleContent>
        <div className="space-y-3 pt-2.5 pb-3">
          <InspectorInset
            tone="cyan"
            className="text-[11px] leading-relaxed text-cyan-700 dark:text-cyan-300"
          >
            Click an endpoint handle on the canvas to draw new wall segments. Drag endpoints to
            reshape. Drag one endpoint onto another to connect them.
          </InspectorInset>

          {room.walls.map((wall, wallIndex) => (
            <WallCard
              key={wall.id}
              wall={wall}
              wallIndex={wallIndex}
              planner={planner}
              isSelected={wall.id === selectedWallId}
              onSelect={() => setSelectedWallId(wall.id)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function WallCard({
  isSelected,
  onSelect,
  planner,
  wall,
  wallIndex,
}: {
  isSelected: boolean;
  onSelect: () => void;
  planner: WallsSectionPlanner;
  wall: Wall;
  wallIndex: number;
}) {
  const {
    addWallFeature,
    disconnectEndpoint,
    fromDisplay,
    removeWall,
    removeWallFeature,
    room,
    setWallLength,
    toDisplay,
    unit,
    updateWall,
    updateWallFeature,
  } = planner;

  const endpointMap = new Map(room.endpoints.map((endpoint) => [endpoint.id, endpoint]));
  const start = endpointMap.get(wall.startId);
  const end = endpointMap.get(wall.endId);

  if (!start || !end) {
    return null;
  }

  const wallLength = getWallLength(start.x, start.y, end.x, end.y);
  const startConnections = getConnectionCount(room.walls, wall.startId, wall.id);
  const endConnections = getConnectionCount(room.walls, wall.endId, wall.id);
  const unitSuffix = getUnitSuffix(unit);
  const measurementStep = getMeasurementStep(unit);

  return (
    <InspectorListRow
      asChild
      selected={isSelected}
      tone="cyan"
      className="cursor-pointer space-y-2"
    >
      <div data-sidebar-wall-id={wall.id} onClick={onSelect}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/80 text-[10px] font-bold text-white">
            {wallIndex + 1}
          </span>
          <WallLengthInput
            wallId={wall.id}
            wallLength={wallLength}
            unit={unit}
            toDisplay={toDisplay}
            fromDisplay={fromDisplay}
            setWallLength={setWallLength}
            measurementStep={measurementStep}
            unitSuffix={unitSuffix}
            disabled={wall.locked}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 flex-shrink-0 p-0"
            title={wall.locked ? "Unlock wall" : "Lock wall"}
            onClick={() => updateWall(wall.id, { locked: !wall.locked })}
          >
            {wall.locked ? (
              <Lock className="h-3 w-3 text-amber-400" />
            ) : (
              <Unlock className="h-3 w-3 text-gray-400" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 flex-shrink-0 p-0"
            title="Remove wall"
            onClick={() => removeWall(wall.id)}
            disabled={wall.locked}
          >
            <Trash2 className="h-3 w-3 text-red-400" />
          </Button>
        </div>

        {startConnections > 0 || endConnections > 0 ? (
          <div className="flex gap-1 text-[10px]">
            {startConnections > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-amber-500"
                title="Disconnect start endpoint"
                onClick={() => disconnectEndpoint(wall.startId, wall.id)}
              >
                <Unlink className="mr-0.5 h-2.5 w-2.5" />
                Start
              </Button>
            ) : null}
            {endConnections > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] text-amber-500"
                title="Disconnect end endpoint"
                onClick={() => disconnectEndpoint(wall.endId, wall.id)}
              >
                <Unlink className="mr-0.5 h-2.5 w-2.5" />
                End
              </Button>
            ) : null}
          </div>
        ) : null}

        {wall.features.length > 0 ? (
          <div className="space-y-1.5 pt-1">
            <span className="text-[10px] font-medium tracking-wider text-gray-400 uppercase dark:text-white/30">
              Features
            </span>
            {wall.features.map((feature) => (
              <WallFeatureCard
                key={feature.id}
                feature={feature}
                fromDisplay={fromDisplay}
                removeWallFeature={removeWallFeature}
                toDisplay={toDisplay}
                unit={unit}
                updateWallFeature={updateWallFeature}
                wallId={wall.id}
                wallLength={wallLength}
              />
            ))}
          </div>
        ) : null}

        <WallFeatureActions
          wallId={wall.id}
          wallLength={wallLength}
          addWallFeature={addWallFeature}
        />
      </div>
    </InspectorListRow>
  );
}

function WallFeatureCard({
  feature,
  fromDisplay,
  removeWallFeature,
  toDisplay,
  unit,
  updateWallFeature,
  wallId,
  wallLength,
}: {
  feature: WallFeature;
  fromDisplay: Parser;
  removeWallFeature: RoomPlannerReturn["removeWallFeature"];
  toDisplay: Formatter;
  unit: Unit;
  updateWallFeature: RoomPlannerReturn["updateWallFeature"];
  wallId: string;
  wallLength: number;
}) {
  const { Icon, accentClass, cardClass, label } = featureMeta[feature.type];
  const unitSuffix = getUnitSuffix(unit);
  const measurementStep = getMeasurementStep(unit);

  return (
    <div className={cn("space-y-2 rounded-xl border px-2.5 py-2.5", cardClass)}>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5", accentClass)} />
        <span className={cn("text-[11px] font-medium capitalize", accentClass)}>{label}</span>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto h-5 w-5 p-0"
          onClick={() => removeWallFeature(wallId, feature.id)}
        >
          <Trash2 className="h-3 w-3 text-red-400" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="w-7 flex-shrink-0 text-[9px] text-gray-400 dark:text-white/25">Pos</span>
        <CompactMeasurementInput
          value={feature.offset}
          unit={unit}
          toDisplay={toDisplay}
          suffix={unitSuffix}
          step={measurementStep}
          onChange={(value) =>
            updateWallFeature(wallId, feature.id, {
              offset: clamp(fromDisplay(value), 0, wallLength - feature.width),
            })
          }
        />
        <span className="w-4 flex-shrink-0 text-center text-[9px] text-gray-400 dark:text-white/25">
          W
        </span>
        <CompactMeasurementInput
          value={feature.width}
          unit={unit}
          toDisplay={toDisplay}
          suffix={unitSuffix}
          step={measurementStep}
          min={1}
          onChange={(value) => {
            if (value > 0) {
              updateWallFeature(wallId, feature.id, {
                width: Math.min(wallLength - feature.offset, fromDisplay(value)),
              });
            }
          }}
        />
      </div>

      {feature.type === "door" ? (
        <DoorFeatureControls
          swingDirection={feature.swingDirection ?? "inward"}
          swingHand={feature.swingHand ?? "left"}
          onChange={(patch) => updateWallFeature(wallId, feature.id, patch)}
        />
      ) : null}
    </div>
  );
}

function WallLengthInput({
  disabled,
  fromDisplay,
  measurementStep,
  setWallLength,
  toDisplay,
  unit,
  unitSuffix,
  wallId,
  wallLength,
}: {
  disabled?: boolean;
  fromDisplay: Parser;
  measurementStep: number;
  setWallLength: RoomPlannerReturn["setWallLength"];
  toDisplay: Formatter;
  unit: Unit;
  unitSuffix: string;
  wallId: string;
  wallLength: number;
}) {
  const displayValue = formatMeasurementValue(wallLength, unit, toDisplay);
  const [localValue, setLocalValue] = useState<string>(String(displayValue));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(displayValue));
    }
  }, [displayValue, isFocused]);

  const commit = () => {
    const nextValue = Number.parseFloat(localValue);
    if (!Number.isNaN(nextValue) && nextValue > 0) {
      setWallLength(wallId, fromDisplay(nextValue));
    } else {
      setLocalValue(String(displayValue));
    }
    setIsFocused(false);
  };

  return (
    <div className="relative flex-1">
      <Input
        type="number"
        value={isFocused ? localValue : displayValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setLocalValue(String(displayValue));
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            (event.target as HTMLInputElement).blur();
          }
        }}
        className="h-7 pr-8 text-xs"
        min={1}
        step={measurementStep}
        disabled={disabled}
      />
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-gray-400 dark:text-white/30">
        {unitSuffix}
      </span>
    </div>
  );
}

function CompactMeasurementInput({
  disabled,
  min = 0,
  onChange,
  step,
  suffix,
  toDisplay,
  unit,
  value,
}: {
  disabled?: boolean;
  min?: number;
  onChange: (value: number) => void;
  step: number;
  suffix: string;
  toDisplay: Formatter;
  unit: Unit;
  value: number;
}) {
  const displayValue = formatMeasurementValue(value, unit, toDisplay);
  const [localValue, setLocalValue] = useState<string>(String(displayValue));
  const [isFocused, setIsFocused] = useState(false);

  // Sync local value from prop when not focused
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(displayValue));
    }
  }, [displayValue, isFocused]);

  const commit = () => {
    const nextValue = Number.parseFloat(localValue);
    if (!Number.isNaN(nextValue)) {
      onChange(nextValue);
    } else {
      setLocalValue(String(displayValue));
    }
    setIsFocused(false);
  };

  return (
    <div className="relative flex-1">
      <Input
        type="number"
        value={isFocused ? localValue : displayValue}
        onChange={(event) => setLocalValue(event.target.value)}
        onFocus={() => {
          setIsFocused(true);
          setLocalValue(String(displayValue));
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            (event.target as HTMLInputElement).blur();
          }
        }}
        className="h-6 bg-white/80 pr-6 text-[11px] dark:bg-slate-900/70"
        min={min}
        step={step}
        disabled={disabled}
      />
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[9px] text-gray-400 dark:text-white/25">
        {suffix}
      </span>
    </div>
  );
}

function DoorFeatureControls({
  onChange,
  swingDirection,
  swingHand,
}: {
  onChange: (patch: Partial<WallFeature>) => void;
  swingDirection: NonNullable<WallFeature["swingDirection"]>;
  swingHand: NonNullable<WallFeature["swingHand"]>;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-gray-400 dark:text-white/35">Swing</span>
        <div className="grid grid-cols-2 gap-1">
          <FeatureOptionButton
            selected={swingDirection === "inward"}
            title="Swing inward (into room)"
            label="Inward"
            onClick={() => onChange({ swingDirection: "inward" })}
          >
            <InwardSwingIcon />
          </FeatureOptionButton>
          <FeatureOptionButton
            selected={swingDirection === "outward"}
            title="Swing outward (away from room)"
            label="Outward"
            onClick={() => onChange({ swingDirection: "outward" })}
          >
            <OutwardSwingIcon />
          </FeatureOptionButton>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-[11px] text-gray-400 dark:text-white/35">Hinge</span>
        <div className="grid grid-cols-2 gap-1">
          <FeatureOptionButton
            selected={swingHand === "left"}
            title="Hinge on left (start) side"
            label="Left"
            onClick={() => onChange({ swingHand: "left" })}
          >
            <LeftHingeIcon />
          </FeatureOptionButton>
          <FeatureOptionButton
            selected={swingHand === "right"}
            title="Hinge on right (end) side"
            label="Right"
            onClick={() => onChange({ swingHand: "right" })}
          >
            <RightHingeIcon />
          </FeatureOptionButton>
        </div>
      </div>
    </div>
  );
}

function FeatureOptionButton({
  children,
  label,
  onClick,
  selected,
  title,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <InspectorOptionCard
      asChild
      layout="column"
      selected={selected}
      tone="indigo"
      className="gap-1 px-2 py-2"
    >
      <button type="button" onClick={onClick} title={title}>
        {children}
        <span className="text-[10px] leading-tight">{label}</span>
      </button>
    </InspectorOptionCard>
  );
}

function FeatureCreateButton({
  accentClassName,
  icon: Icon,
  label,
  onClick,
}: {
  accentClassName: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <InspectorOptionCard
      asChild
      tone="neutral"
      className="gap-2 px-2.5 py-2 text-gray-500 dark:text-white/55"
    >
      <button type="button" onClick={onClick}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", accentClassName)} />
        <span className="text-[11px] font-medium">{label}</span>
      </button>
    </InspectorOptionCard>
  );
}

function WallFeatureActions({
  addWallFeature,
  wallId,
  wallLength,
}: {
  addWallFeature: RoomPlannerReturn["addWallFeature"];
  wallId: string;
  wallLength: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-1.5 pt-0.5">
      <FeatureCreateButton
        icon={DoorIcon}
        accentClassName="text-indigo-500"
        label="Add Door"
        onClick={() =>
          addWallFeature(wallId, {
            type: "door",
            offset: wallLength * 0.3,
            width: 36,
            swingDirection: "inward",
            swingHand: "left",
          })
        }
      />
      <FeatureCreateButton
        icon={WindowIcon}
        accentClassName="text-sky-500"
        label="Add Window"
        onClick={() =>
          addWallFeature(wallId, {
            type: "window",
            offset: wallLength * 0.3,
            width: 36,
            sillHeight: 36,
            height: 48,
          })
        }
      />
      <FeatureCreateButton
        icon={OpeningIcon}
        accentClassName="text-emerald-500"
        label="Add Opening"
        onClick={() =>
          addWallFeature(wallId, {
            type: "opening",
            offset: wallLength * 0.3,
            width: 42,
          })
        }
      />
      <FeatureCreateButton
        icon={ClosetIcon}
        accentClassName="text-stone-400"
        label="Add Closet"
        onClick={() =>
          addWallFeature(wallId, {
            type: "closet",
            offset: wallLength * 0.2,
            width: 48,
            height: 96,
          })
        }
      />
    </div>
  );
}

function CustomFurnitureCreator({
  addFurniture,
  fromDisplay,
  toDisplay,
  unit,
}: {
  addFurniture: RoomPlannerReturn["addFurniture"];
  fromDisplay: Parser;
  toDisplay: Formatter;
  unit: Unit;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [customName, setCustomName] = useState("Custom Piece");
  const [customWidth, setCustomWidth] = useState(60);
  const [customDepth, setCustomDepth] = useState(30);
  const [customShape, setCustomShape] = useState<FurnitureShape>("rectangle");

  const unitSuffix = getUnitSuffix(unit);
  const trimmedName = customName.trim();

  const customPreset: FurniturePreset = {
    type: "custom",
    name: trimmedName || "Custom Piece",
    shape: customShape,
    width: Math.max(1, customWidth),
    depth: Math.max(1, customDepth),
    color: customShape === "circle" ? "#38bdf8" : "#94a3b8",
  };

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className="rounded-xl border border-gray-200/70 bg-gray-50/80 dark:border-white/10 dark:bg-white/[0.04]"
    >
      <CollapsibleTrigger className="flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-100/70 dark:hover:bg-white/[0.03]">
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold text-gray-800 dark:text-white/85">
            Custom Piece
          </span>
          <span className="truncate text-[11px] text-gray-500 dark:text-white/35">
            {customShape === "circle" ? "Circle" : "Square"} •{" "}
            {formatFurnitureFootprint(
              customPreset.width,
              customPreset.depth,
              toDisplay,
              unitSuffix,
            )}
          </span>
        </div>
        <span className="text-[10px] text-gray-400 dark:text-white/25">
          {isExpanded ? "Hide" : "Build"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-gray-400 transition-transform duration-200",
            !isExpanded && "-rotate-90",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-3 border-t border-gray-200/70 px-3 py-3 dark:border-white/10">
          <div className="space-y-1">
            <Label className="text-xs text-gray-500 dark:text-white/50">Name</Label>
            <Input
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              className="h-8 text-xs"
              placeholder="Custom Piece"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <NumberInput
              label="Width"
              value={toDisplay(customWidth)}
              onChange={(value) => setCustomWidth(fromDisplay(value))}
              suffix={unitSuffix}
              min={1}
            />
            <NumberInput
              label="Depth"
              value={toDisplay(customDepth)}
              onChange={(value) => setCustomDepth(fromDisplay(value))}
              suffix={unitSuffix}
              min={1}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-gray-500 dark:text-white/50">Shape</Label>
            <div className="grid grid-cols-2 gap-1.5">
              <InspectorOptionCard
                asChild
                layout="column"
                selected={customShape === "rectangle"}
                tone="emerald"
                className="gap-1.5 px-2.5 py-2.5"
              >
                <button type="button" onClick={() => setCustomShape("rectangle")}>
                  <div className="h-5 w-5 rounded-[4px] border-2 border-current" />
                  <span className="text-[10px] leading-tight">Square</span>
                </button>
              </InspectorOptionCard>
              <InspectorOptionCard
                asChild
                layout="column"
                selected={customShape === "circle"}
                tone="cyan"
                className="gap-1.5 px-2.5 py-2.5"
              >
                <button type="button" onClick={() => setCustomShape("circle")}>
                  <div className="h-5 w-5 rounded-full border-2 border-current" />
                  <span className="text-[10px] leading-tight">Circle</span>
                </button>
              </InspectorOptionCard>
            </div>
          </div>

          <Button
            size="sm"
            className="h-8 w-full text-xs"
            onClick={() => addFurniture(customPreset)}
            disabled={customWidth <= 0 || customDepth <= 0}
          >
            Add Custom Piece
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function FurnitureCategoryPicker({
  activeCategory,
  onChange,
}: {
  activeCategory: string;
  onChange: (value: string) => void;
}) {
  return (
    <InspectorSegmentedControl className="grid-cols-3">
      {FURNITURE_CATEGORIES.map((category) => (
        <InspectorSegmentedControlItem
          key={category.label}
          asChild
          selected={activeCategory === category.label}
          tone="neutral"
        >
          <button type="button" onClick={() => onChange(category.label)}>
            {category.label}
          </button>
        </InspectorSegmentedControlItem>
      ))}
    </InspectorSegmentedControl>
  );
}

function FurniturePresetGrid({
  addFurniture,
  categoryLabel,
  toDisplay,
  unitSuffix,
}: {
  addFurniture: RoomPlannerReturn["addFurniture"];
  categoryLabel: string;
  toDisplay: Formatter;
  unitSuffix: string;
}) {
  const category = FURNITURE_CATEGORIES.find((entry) => entry.label === categoryLabel);
  const presets = FURNITURE_PRESETS.filter((preset) =>
    (category?.types as readonly string[] | undefined)?.includes(preset.type),
  );

  return (
    <div className="grid grid-cols-2 gap-2">
      {presets.map((preset) => (
        <InspectorOptionCard
          key={preset.name}
          asChild
          layout="column"
          className="min-h-20 items-start justify-between px-3 py-3 text-left"
        >
          <button type="button" onClick={() => addFurniture(preset)}>
            <span className="line-clamp-2 text-sm font-semibold text-gray-800 dark:text-white/85">
              {preset.name}
            </span>
            <span className="text-xs text-gray-400 dark:text-white/30">
              {formatFurnitureFootprint(preset.width, preset.depth, toDisplay, unitSuffix)}
            </span>
          </button>
        </InspectorOptionCard>
      ))}
    </div>
  );
}

function PulloutSofaInspector({
  fromDisplay,
  furniture,
  setPulloutBedSize,
  togglePulloutSofa,
  toDisplay,
  unit,
  updatePulloutSofa,
}: {
  fromDisplay: Parser;
  furniture: FurnitureItem & { pulloutSofa: PulloutSofaState };
  setPulloutBedSize: RoomPlannerReturn["setPulloutBedSize"];
  togglePulloutSofa: RoomPlannerReturn["togglePulloutSofa"];
  toDisplay: Formatter;
  unit: Unit;
  updatePulloutSofa: RoomPlannerReturn["updatePulloutSofa"];
}) {
  const unitSuffix = getUnitSuffix(unit);

  return (
    <>
      <InspectorInset tone="violet" className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-violet-700 dark:text-violet-300">
            Pull-out Controls
          </Label>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[11px]"
            onClick={() => togglePulloutSofa(furniture.id)}
          >
            {furniture.pulloutSofa.isOpen ? "Close Sofa" : "Open Bed"}
          </Button>
        </div>

        <InspectorSegmentedControl className="grid-cols-2">
          <InspectorSegmentedControlItem
            asChild
            selected={furniture.pulloutSofa.isOpen}
            tone="violet"
            className="flex flex-col items-center gap-1"
          >
            <button
              type="button"
              onClick={() => !furniture.pulloutSofa.isOpen && togglePulloutSofa(furniture.id)}
            >
              <div className="h-4 w-6 rounded-[4px] border-2 border-current" />
              <span className="text-[10px] leading-tight">Open</span>
            </button>
          </InspectorSegmentedControlItem>
          <InspectorSegmentedControlItem
            asChild
            selected={!furniture.pulloutSofa.isOpen}
            tone="violet"
            className="flex flex-col items-center gap-1"
          >
            <button
              type="button"
              onClick={() => furniture.pulloutSofa.isOpen && togglePulloutSofa(furniture.id)}
            >
              <div className="h-4 w-6 rounded-[4px] border-2 border-current bg-current/20" />
              <span className="text-[10px] leading-tight">Closed</span>
            </button>
          </InspectorSegmentedControlItem>
        </InspectorSegmentedControl>

        <div className="flex items-center justify-between">
          <Label className="text-xs text-gray-500 dark:text-white/50">Bed Size</Label>
          <Select
            value={furniture.pulloutSofa.bedSize}
            onValueChange={(value) => setPulloutBedSize(furniture.id, value as PulloutBedSize)}
          >
            <SelectTrigger className="h-7 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(PULLOUT_SOFA_DEFAULTS).map((bedSize) => (
                <SelectItem key={bedSize} value={bedSize}>
                  {getPulloutBedSizeLabel(bedSize as PulloutBedSize)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </InspectorInset>

      <div className="grid grid-cols-2 gap-2">
        <InspectorInset className="space-y-2">
          <Label className="text-xs font-medium text-gray-700 dark:text-white/70">
            Closed Size
          </Label>
          <NumberInput
            label="Width"
            value={toDisplay(furniture.pulloutSofa.closedWidth)}
            onChange={(value) =>
              updatePulloutSofa(furniture.id, {
                closedWidth: fromDisplay(value),
              })
            }
            suffix={unitSuffix}
            min={1}
          />
          <NumberInput
            label="Depth"
            value={toDisplay(furniture.pulloutSofa.closedDepth)}
            onChange={(value) =>
              updatePulloutSofa(furniture.id, {
                closedDepth: fromDisplay(value),
              })
            }
            suffix={unitSuffix}
            min={1}
          />
        </InspectorInset>

        <InspectorInset className="space-y-2">
          <Label className="text-xs font-medium text-gray-700 dark:text-white/70">Open Size</Label>
          <NumberInput
            label="Width"
            value={toDisplay(furniture.pulloutSofa.openWidth)}
            onChange={(value) =>
              updatePulloutSofa(furniture.id, {
                openWidth: fromDisplay(value),
              })
            }
            suffix={unitSuffix}
            min={1}
          />
          <NumberInput
            label="Depth"
            value={toDisplay(furniture.pulloutSofa.openDepth)}
            onChange={(value) =>
              updatePulloutSofa(furniture.id, {
                openDepth: fromDisplay(value),
              })
            }
            suffix={unitSuffix}
            min={1}
          />
        </InspectorInset>
      </div>
    </>
  );
}

function FurnitureItemInspector({
  bringFurnitureToFront,
  duplicateFurniture,
  fromDisplay,
  furniture,
  furnitureCount,
  layerIndex,
  moveFurnitureBackward,
  moveFurnitureForward,
  removeFurniture,
  rotateFurniture,
  sendFurnitureToBack,
  setPulloutBedSize,
  togglePulloutSofa,
  toDisplay,
  unit,
  updateFurniture,
  updatePulloutSofa,
}: {
  bringFurnitureToFront: RoomPlannerReturn["bringFurnitureToFront"];
  duplicateFurniture: RoomPlannerReturn["duplicateFurniture"];
  fromDisplay: Parser;
  furniture: FurnitureItem;
  furnitureCount: number;
  layerIndex: number;
  moveFurnitureBackward: RoomPlannerReturn["moveFurnitureBackward"];
  moveFurnitureForward: RoomPlannerReturn["moveFurnitureForward"];
  removeFurniture: RoomPlannerReturn["removeFurniture"];
  rotateFurniture: RoomPlannerReturn["rotateFurniture"];
  sendFurnitureToBack: RoomPlannerReturn["sendFurnitureToBack"];
  setPulloutBedSize: RoomPlannerReturn["setPulloutBedSize"];
  togglePulloutSofa: RoomPlannerReturn["togglePulloutSofa"];
  toDisplay: Formatter;
  unit: Unit;
  updateFurniture: RoomPlannerReturn["updateFurniture"];
  updatePulloutSofa: RoomPlannerReturn["updatePulloutSofa"];
}) {
  const unitSuffix = getUnitSuffix(unit);
  const canMoveBackward = layerIndex > 0;
  const canMoveForward = layerIndex < furnitureCount - 1;

  return (
    <div
      className="space-y-3 border-t border-indigo-400/15 pt-3 dark:border-indigo-500/15"
      onClick={(event) => event.stopPropagation()}
    >
      {isPulloutSofa(furniture) ? (
        <PulloutSofaInspector
          fromDisplay={fromDisplay}
          furniture={furniture}
          setPulloutBedSize={setPulloutBedSize}
          togglePulloutSofa={togglePulloutSofa}
          toDisplay={toDisplay}
          unit={unit}
          updatePulloutSofa={updatePulloutSofa}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            label="Width"
            value={toDisplay(furniture.width)}
            onChange={(value) =>
              updateFurniture(furniture.id, {
                width: fromDisplay(value),
              })
            }
            suffix={unitSuffix}
            min={1}
          />
          <NumberInput
            label="Depth"
            value={toDisplay(furniture.depth)}
            onChange={(value) =>
              updateFurniture(furniture.id, {
                depth: fromDisplay(value),
              })
            }
            suffix={unitSuffix}
            min={1}
          />
        </div>
      )}

      <NumberInput
        label="Rotation"
        value={furniture.rotation}
        onChange={(value) => rotateFurniture(furniture.id, ((value % 360) + 360) % 360)}
        suffix="deg"
        min={0}
        max={359}
        step={1}
      />

      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() => rotateFurniture(furniture.id, (furniture.rotation + 15) % 360)}
        >
          <RotateCw className="mr-1 h-3 w-3" />
          +15°
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() => duplicateFurniture(furniture.id)}
        >
          <Copy className="mr-1 h-3 w-3" />
          Duplicate
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs text-gray-500 dark:text-white/50">Layer</Label>
          <span className="text-[11px] text-gray-400 dark:text-white/35">
            {layerIndex + 1} of {furnitureCount}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => sendFurnitureToBack(furniture.id)}
            disabled={!canMoveBackward}
          >
            <ChevronsDown className="mr-1 h-3 w-3" />
            To Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => moveFurnitureBackward(furniture.id)}
            disabled={!canMoveBackward}
          >
            <ChevronDown className="mr-1 h-3 w-3" />
            Backward
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => moveFurnitureForward(furniture.id)}
            disabled={!canMoveForward}
          >
            <ChevronUp className="mr-1 h-3 w-3" />
            Forward
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => bringFurnitureToFront(furniture.id)}
            disabled={!canMoveForward}
          >
            <ChevronsUp className="mr-1 h-3 w-3" />
            To Front
          </Button>
        </div>
      </div>

      <div className="flex gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() =>
            updateFurniture(furniture.id, {
              locked: !furniture.locked,
            })
          }
        >
          {furniture.locked ? (
            <Lock className="mr-1 h-3 w-3" />
          ) : (
            <Unlock className="mr-1 h-3 w-3" />
          )}
          {furniture.locked ? "Unlock" : "Lock"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="h-7 flex-1 text-xs"
          onClick={() => removeFurniture(furniture.id)}
        >
          <Trash2 className="mr-1 h-3 w-3" />
          Remove
        </Button>
      </div>
    </div>
  );
}

function FurnitureSection({
  open,
  onToggle,
  planner,
}: {
  onToggle: () => void;
  open: boolean;
  planner: FurnitureSectionPlanner;
}) {
  const {
    addFurniture,
    bringFurnitureToFront,
    duplicateFurniture,
    furniture,
    fromDisplay,
    moveFurnitureBackward,
    moveFurnitureForward,
    removeFurniture,
    rotateFurniture,
    sendFurnitureToBack,
    setPulloutBedSize,
    selectedId,
    selectedIds,
    setSelectedId,
    togglePulloutSofa,
    toDisplay,
    unit,
    updateFurniture,
    updatePulloutSofa,
  } = planner;

  const [activeCategory, setActiveCategory] = useState(FURNITURE_CATEGORIES[0].label);
  const unitSuffix = getUnitSuffix(unit);

  return (
    <Collapsible open={open} className="border-b border-gray-200 dark:border-white/10">
      <SectionHeader
        icon={Sofa}
        label="Furniture"
        iconColor="text-emerald-500"
        onToggle={onToggle}
      />
      <CollapsibleContent>
        <div className="space-y-3 pt-2.5 pb-3">
          <FurnitureCategoryPicker activeCategory={activeCategory} onChange={setActiveCategory} />

          <FurniturePresetGrid
            addFurniture={addFurniture}
            categoryLabel={activeCategory}
            toDisplay={toDisplay}
            unitSuffix={unitSuffix}
          />

          <CustomFurnitureCreator
            addFurniture={addFurniture}
            fromDisplay={fromDisplay}
            toDisplay={toDisplay}
            unit={unit}
          />

          {furniture.length > 0 ? (
            <>
              <Separator />
              <Label className="text-xs text-gray-500 dark:text-white/50">
                Placed Items ({furniture.length})
              </Label>
              {selectedIds.length > 1 ? (
                <p className="text-[11px] text-gray-400 dark:text-white/35">
                  {selectedIds.length} items selected on canvas
                </p>
              ) : null}
              <div className="space-y-1">
                {furniture.map((item, index) => (
                  <InspectorListRow
                    key={item.id}
                    asChild
                    selected={selectedIds.includes(item.id)}
                    tone="cyan"
                    className="cursor-pointer text-[11px]"
                  >
                    <div data-sidebar-furniture-id={item.id} onClick={() => setSelectedId(item.id)}>
                      <div className="flex items-center gap-2 px-0.5 py-0.5">
                        <div
                          className="h-3 w-3 flex-shrink-0 rounded-sm"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="flex-1 truncate">{item.name}</span>
                        <span className="text-gray-400 dark:text-white/30">
                          {toDisplay(item.width).toFixed(0)}x{toDisplay(item.depth).toFixed(0)}
                        </span>
                      </div>
                      {selectedIds.length === 1 && item.id === selectedId ? (
                        <FurnitureItemInspector
                          bringFurnitureToFront={bringFurnitureToFront}
                          duplicateFurniture={duplicateFurniture}
                          fromDisplay={fromDisplay}
                          furniture={item}
                          furnitureCount={furniture.length}
                          layerIndex={index}
                          moveFurnitureBackward={moveFurnitureBackward}
                          moveFurnitureForward={moveFurnitureForward}
                          removeFurniture={removeFurniture}
                          rotateFurniture={rotateFurniture}
                          sendFurnitureToBack={sendFurnitureToBack}
                          setPulloutBedSize={setPulloutBedSize}
                          togglePulloutSofa={togglePulloutSofa}
                          toDisplay={toDisplay}
                          unit={unit}
                          updateFurniture={updateFurniture}
                          updatePulloutSofa={updatePulloutSofa}
                        />
                      ) : null}
                    </div>
                  </InspectorListRow>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function HistoryDebugSection({
  open,
  onToggle,
  planner,
}: {
  open: boolean;
  onToggle: () => void;
  planner: HistoryDebugPlanner;
}) {
  const entries = [
    ...planner.historyDebug.past.map((entry) => ({
      ...entry,
      tone: "past" as const,
    })),
    { ...planner.historyDebug.present, tone: "present" as const },
    ...planner.historyDebug.future.map((entry) => ({
      ...entry,
      tone: "future" as const,
    })),
  ];

  return (
    <Collapsible open={open} className="border-b border-gray-200 dark:border-white/10">
      <SectionHeader
        icon={History}
        iconColor="text-amber-500"
        label="History"
        onToggle={onToggle}
      />
      <CollapsibleContent>
        <div className="space-y-2 pt-2.5 pb-3">
          {planner.historyDebug.locked ? (
            <InspectorInset tone="amber" className="space-y-2">
              <div className="text-xs font-medium text-amber-700 dark:text-amber-200">
                You are viewing an earlier version. To make changes, go back to the latest version
                or start editing from this point.
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={planner.returnToLatestHistory}
                >
                  Return To Latest
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => {
                    const futureCount = planner.historyDebug.futureCount;
                    const message =
                      futureCount === 1
                        ? "Editing from this point will discard 1 future change. Continue?"
                        : `Editing from this point will discard ${futureCount} future changes. Continue?`;
                    if (window.confirm(message)) {
                      planner.discardFutureHistory();
                    }
                  }}
                >
                  Edit From Here
                </Button>
              </div>
            </InspectorInset>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <InspectorInset className="px-2.5 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/35">
                Undo
              </div>
              <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {planner.historyDebug.pastCount}
              </div>
            </InspectorInset>
            <InspectorInset tone="cyan" className="px-2.5 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-cyan-600/80 dark:text-cyan-300/75">
                Current
              </div>
              <div className="mt-1 text-sm font-semibold text-cyan-700 dark:text-cyan-100">
                #{planner.historyDebug.currentPosition + 1} of {planner.historyDebug.totalCount}
              </div>
            </InspectorInset>
            <InspectorInset className="px-2.5 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/35">
                Redo
              </div>
              <div className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                {planner.historyDebug.futureCount}
              </div>
            </InspectorInset>
          </div>

          <InspectorInset className="px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-gray-400 dark:text-white/35">
              Snapshot Key
            </div>
            <div className="mt-1 break-all font-mono text-[11px] leading-5 text-gray-600 dark:text-white/65">
              {planner.historyDebug.key ?? "none"}
            </div>
          </InspectorInset>

          <div className="space-y-1.5">
            {entries.map((entry) => (
              <InspectorListRow
                key={entry.id}
                asChild
                selected={entry.tone === "present"}
                tone="cyan"
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs"
              >
                <button
                  type="button"
                  onClick={() => planner.jumpToHistory(entry.position)}
                  disabled={entry.tone === "present"}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.12em]",
                          entry.tone === "present"
                            ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-200"
                            : "bg-gray-200/70 text-gray-500 dark:bg-white/10 dark:text-white/45",
                        )}
                      >
                        {entry.tone === "present" ? "current" : "step"}
                      </span>
                      <span className="font-medium">Step {entry.position + 1}</span>
                    </div>
                    <div className="mt-1 text-[11px] opacity-65">
                      {entry.endpointCount} endpoints, {entry.wallCount} walls,{" "}
                      {entry.furnitureCount} furniture
                    </div>
                  </div>
                  <span className="text-[11px] font-medium opacity-75">
                    {entry.tone === "present" ? "Live" : "Jump"}
                  </span>
                </button>
              </InspectorListRow>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function InwardSwingIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" className="h-6 w-6">
      <rect
        x="2"
        y="2"
        width="24"
        height="24"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.2"
      />
      <line x1="2" y1="26" x2="9" y2="26" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="21" y1="26" x2="26" y2="26" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <path d="M 9 26 L 9 14" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 9 14 A 12 12 0 0 1 21 26" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function OutwardSwingIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" className="h-6 w-6">
      <rect
        x="2"
        y="14"
        width="24"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.2"
      />
      <line x1="2" y1="14" x2="9" y2="14" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <line x1="21" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="2" opacity="0.5" />
      <path d="M 9 14 L 9 2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M 9 2 A 12 12 0 0 1 21 14" stroke="currentColor" strokeWidth="1" opacity="0.4" />
    </svg>
  );
}

function LeftHingeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-5 w-5"
    >
      <circle cx="5" cy="12" r="2.5" fill="currentColor" strokeWidth="0" />
      <line x1="7.5" y1="12" x2="20" y2="12" strokeWidth="2" />
    </svg>
  );
}

function RightHingeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-5 w-5"
    >
      <line x1="4" y1="12" x2="16.5" y2="12" strokeWidth="2" />
      <circle cx="19" cy="12" r="2.5" fill="currentColor" strokeWidth="0" />
    </svg>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatMeasurementValue(value: number, unit: Unit, toDisplay: Formatter) {
  const displayValue = toDisplay(value);
  return unit === "cm"
    ? Number.parseFloat(displayValue.toFixed(0))
    : Number.parseFloat(displayValue.toFixed(3));
}

function getConnectionCount(walls: Wall[], endpointId: string, wallId: string) {
  return walls.filter(
    (wall) => wall.id !== wallId && (wall.startId === endpointId || wall.endId === endpointId),
  ).length;
}

function getMeasurementStep(unit: Unit) {
  return unit === "cm" ? 1 : 0.125;
}

function getUnitSuffix(unit: Unit) {
  return unit === "cm" ? "cm" : '"';
}

function formatFurnitureFootprint(
  width: number,
  depth: number,
  toDisplay: Formatter,
  unitSuffix: string,
) {
  return `${toDisplay(width).toFixed(0)} x ${toDisplay(depth).toFixed(0)}${unitSuffix}`;
}

function isPulloutSofa(
  item: FurnitureItem,
): item is FurnitureItem & { pulloutSofa: PulloutSofaState } {
  return item.type === "pullout-sofa" && Boolean(item.pulloutSofa);
}

function getPulloutBedSizeLabel(bedSize: PulloutBedSize) {
  switch (bedSize) {
    case "twin":
      return "Twin";
    case "full":
      return "Full";
    case "queen":
      return "Queen";
    case "king":
      return "King";
  }
}

function getWallLength(ax: number, ay: number, bx: number, by: number) {
  return Math.sqrt((bx - ax) ** 2 + (by - ay) ** 2);
}

export function Sidebar({ planner, projects }: SidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previousSelectedIdRef = useRef<string | null>(null);
  const previousSelectedWallIdRef = useRef<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [projectBrowserOpen, setProjectBrowserOpen] = useState(false);
  const [roomOpen, setRoomOpen] = useState(true);
  const [wallsOpen, setWallsOpen] = useState(false);
  const [furnitureOpen, setFurnitureOpen] = useState(true);
  const [historyDebugOpen, setHistoryDebugOpen] = useState(false);
  const isHistoryEditingLocked = planner.isHistoryEditingLocked;

  const { canRedo, canUndo, redo, selectedId, selectedWallId, undo } = planner;

  const scrollSidebarItemIntoView = useCallback((selector: string) => {
    const panel = panelRef.current;
    if (!panel) return false;

    const viewport = panel.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]');
    const target = panel.querySelector<HTMLElement>(selector);
    if (!viewport || !target) return false;

    const viewportRect = viewport.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const targetTop = targetRect.top - viewportRect.top + viewport.scrollTop;
    const centeredTop = targetTop - viewport.clientHeight / 2 + targetRect.height / 2;

    viewport.scrollTo({
      top: Math.max(0, centeredTop),
      behavior: "smooth",
    });
    return true;
  }, []);

  useEffect(() => {
    if (selectedWallId && selectedWallId !== previousSelectedWallIdRef.current && !wallsOpen) {
      setWallsOpen(true);
    }
    previousSelectedWallIdRef.current = selectedWallId;
  }, [selectedWallId, wallsOpen]);

  useEffect(() => {
    if (selectedId && selectedId !== previousSelectedIdRef.current && !furnitureOpen) {
      setFurnitureOpen(true);
    }
    previousSelectedIdRef.current = selectedId;
  }, [selectedId, furnitureOpen]);

  useEffect(() => {
    if (!isOpen || !selectedWallId || !wallsOpen) return;

    let frame = requestAnimationFrame(() => {
      if (!scrollSidebarItemIntoView(`[data-sidebar-wall-id="${selectedWallId}"]`)) {
        frame = requestAnimationFrame(() => {
          scrollSidebarItemIntoView(`[data-sidebar-wall-id="${selectedWallId}"]`);
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [isOpen, scrollSidebarItemIntoView, selectedWallId, wallsOpen]);

  useEffect(() => {
    if (!isOpen || !selectedId || !furnitureOpen) return;

    let frame = requestAnimationFrame(() => {
      if (!scrollSidebarItemIntoView(`[data-sidebar-furniture-id="${selectedId}"]`)) {
        frame = requestAnimationFrame(() => {
          scrollSidebarItemIntoView(`[data-sidebar-furniture-id="${selectedId}"]`);
        });
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [furnitureOpen, isOpen, scrollSidebarItemIntoView, selectedId]);

  return (
    <div className="fixed top-4 bottom-4 left-4 z-50 w-[340px] pointer-events-none">
      <motion.div
        className="absolute top-0 left-0 z-10"
        initial={false}
        animate={{
          opacity: isOpen ? 0 : 1,
          scale: isOpen ? 0.82 : 1,
          x: isOpen ? -18 : 0,
        }}
        transition={{
          type: "spring",
          stiffness: 360,
          damping: 28,
          opacity: { duration: 0.16 },
        }}
        style={{ pointerEvents: isOpen ? "none" : "auto" }}
      >
        <FloatingIconButton onClick={() => setIsOpen(true)} title="Show sidebar">
          <PanelLeftOpen className="h-4 w-4" />
        </FloatingIconButton>
      </motion.div>

      <motion.div
        className="h-full origin-top-left"
        initial={false}
        animate={{
          opacity: isOpen ? 1 : 0,
          scale: isOpen ? 1 : 0.9,
          x: isOpen ? 0 : -42,
        }}
        transition={{
          type: "spring",
          stiffness: 340,
          damping: 30,
          opacity: { duration: 0.16 },
        }}
        style={{ pointerEvents: isOpen ? "auto" : "none" }}
      >
        <ToolPanel
          ref={panelRef}
          data-sidebar-panel="open"
          className="flex h-full flex-col overflow-hidden"
        >
          <SidebarHeader onClose={() => setIsOpen(false)} />

          <SidebarProjectActions
            canRedo={canRedo}
            canUndo={canUndo}
            onBrowseProjects={() => setProjectBrowserOpen(true)}
            onCreateProject={projects.createProject}
            redo={redo}
            undo={undo}
          />

          <ScrollArea className="min-h-0 flex-1 overflow-hidden">
            <div className="max-w-full space-y-0 overflow-hidden p-4">
              <ProjectBrowserSection
                controls={projects}
                projectBrowserOpen={projectBrowserOpen}
                setProjectBrowserOpen={setProjectBrowserOpen}
              />

              <div
                className={cn(
                  isHistoryEditingLocked && "pointer-events-none opacity-45 select-none",
                )}
              >
                <RoomShapeSection
                  open={roomOpen}
                  onToggle={() => setRoomOpen((current) => !current)}
                  planner={planner}
                />
              </div>

              <div
                className={cn(
                  isHistoryEditingLocked && "pointer-events-none opacity-45 select-none",
                )}
              >
                <WallsSection
                  open={wallsOpen}
                  onToggle={() => setWallsOpen((current) => !current)}
                  planner={planner}
                />
              </div>

              <div
                className={cn(
                  isHistoryEditingLocked && "pointer-events-none opacity-45 select-none",
                )}
              >
                <FurnitureSection
                  open={furnitureOpen}
                  onToggle={() => setFurnitureOpen((current) => !current)}
                  planner={planner}
                />
              </div>

              <HistoryDebugSection
                open={historyDebugOpen}
                onToggle={() => setHistoryDebugOpen((current) => !current)}
                planner={planner}
              />
            </div>
          </ScrollArea>
        </ToolPanel>
      </motion.div>
    </div>
  );
}
