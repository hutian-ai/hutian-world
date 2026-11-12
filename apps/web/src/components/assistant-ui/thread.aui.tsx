"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/elements/attachment.aui";
import { File } from "@/components/assistant-ui/file";
import { ThreadFollowupSuggestions } from "@/components/assistant-ui/elements/follow-up-suggestions.aui";
import { Image as MessageImage } from "@/components/assistant-ui/image";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/assistant-ui/elements/reasoning.aui";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback.aui";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/assistant-ui/elements/tool-group.aui";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  type FileMessagePartComponent,
  type ImageMessagePartComponent,
  type TextMessagePartComponent,
  type ToolCallMessagePartComponent,
  type Unstable_DirectiveFormatter,
  unstable_useTriggerPopoverAriaProps,
  useAui,
  useAuiState,
} from "@assistant-ui/react";
import { LexicalComposerInput, type DirectiveChipProps } from "@assistant-ui/react-lexical";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  MicIcon,
  MoreHorizontalIcon,
  SquareIcon,
} from "lucide-react";
import {
  createContext,
  useEffect,
  useContext,
  useRef,
  type ComponentType,
  type FC,
  type PropsWithChildren,
  type ReactNode,
} from "react";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;
export type ThreadGroupBy = MessagePrimitive.GroupedParts.Props["groupBy"];

export type AssistantMoreActionsProps = {
  openDialog: (open: (restoreFocus: () => void) => void) => void;
};

/**
 * Optional component overrides for the thread. `AssistantMessage` and
 * `Welcome` replace whole sections; the remaining slots override how the
 * assistant message renders tool calls and part groups. Tool UIs registered
 * by name (toolkit `render`, `useAssistantDataUI`) take precedence over
 * `ToolFallback`.
 */
export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  UserMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  Composer?:
    | ComponentType<{
        autoFocus: boolean;
        configuration?: ThreadComposerConfiguration;
      }>
    | undefined;
  AssistantActions?: ComponentType | undefined;
  AssistantMoreActions?: ComponentType<AssistantMoreActionsProps> | undefined;
  UserText?: TextMessagePartComponent | undefined;
  AssistantText?: TextMessagePartComponent | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  groupBy?: ThreadGroupBy;
  ActivityGroup?: ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined;
  ToolGroup?: ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined;
  ReasoningGroup?: ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined;
  DataPart?: ComponentType<{ name: string; data: unknown; fallback: ReactNode }> | undefined;
};

export type ThreadComposerConfiguration = {
  before?: ReactNode;
  header?: ReactNode;
  actions?: ReactNode;
  onStopShortcut?: () => void;
  trigger?: ReactNode;
  placeholder?: string;
  formatter?: Unstable_DirectiveFormatter;
  directiveChip?: FC<DirectiveChipProps>;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  composer?: ThreadComposerConfiguration | undefined;
  autoFocus?: boolean | undefined;
};

const EMPTY_COMPONENTS: ThreadComponents = {};

const ThreadComponentsContext = createContext<ThreadComponents>(EMPTY_COMPONENTS);

// Startup exposes a loading placeholder thread; treat it as a new chat so
// the welcome context appears. The composer remains docked in every state.
const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 && (!s.thread.isLoading || s.threads.isLoading);

// A switched thread that is still fetching its history: skeleton, not welcome.
const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

const ThreadHistorySkeleton: FC = () => (
  <div
    data-slot="aui_thread-history-skeleton"
    role="status"
    className="animate-in fade-in fill-mode-both flex flex-col gap-y-6 [animation-delay:150ms] [animation-duration:200ms]"
  >
    <span className="sr-only">Loading conversation</span>
    <Skeleton className="ml-auto h-9 w-2/5 rounded-xl motion-reduce:animate-none" />
    <div className="flex flex-col gap-y-2">
      <Skeleton className="h-4 w-11/12 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-3/5 motion-reduce:animate-none" />
    </div>
    <Skeleton className="ml-auto h-9 w-1/3 rounded-xl motion-reduce:animate-none" />
    <div className="flex flex-col gap-y-2">
      <Skeleton className="h-4 w-10/12 motion-reduce:animate-none" />
      <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
    </div>
  </div>
);

export const Thread: FC<ThreadProps> = ({
  components = EMPTY_COMPONENTS,
  composer,
  autoFocus = true,
}) => {
  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadRoot autoFocus={autoFocus} composer={composer} />
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<{
  autoFocus: boolean;
  composer?: ThreadComposerConfiguration;
}> = ({ autoFocus, composer }) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-message-max-width" as string]: "52rem",
        ["--thread-composer-max-width" as string]: "52rem",
        ["--composer-bg" as string]: "var(--color-card)",
        ["--composer-radius" as string]: "0.5rem",
        ["--composer-padding" as string]: "8px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="bottom"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll"
      >
        <div className="mx-auto flex w-full max-w-(--thread-message-max-width) flex-1 flex-col px-5 pt-6">
          <AuiIf condition={isNewChatView}>
            <Welcome />
          </AuiIf>
          <AuiIf condition={isHistoryLoadingView}>
            <ThreadHistorySkeleton />
          </AuiIf>

          <div data-slot="aui_message-group" className="mb-10 flex flex-col gap-y-4 empty:hidden">
            <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
          </div>
        </div>
        <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer bg-background sticky bottom-0 z-30 isolate mx-auto mt-auto flex w-full max-w-(--thread-composer-max-width) flex-col gap-3 overflow-visible rounded-t-(--composer-radius) px-5 pb-5 pt-2">
          <ThreadScrollToBottom />
          <ThreadFollowupSuggestions />
          {composer?.before}
          <ThreadComposer autoFocus={autoFocus} configuration={composer} />
          <AuiIf condition={(s) => isNewChatView(s) && s.composer.isEmpty}>
            <ThreadSuggestions />
          </AuiIf>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC = () => {
  const {
    AssistantMessage: AssistantMessageComponent = AssistantMessage,
    UserMessage: UserMessageComponent = UserMessage,
  } = useContext(ThreadComponentsContext);
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessageComponent />;
  return <AssistantMessageComponent />;
};

const ThreadComposer: FC<{
  autoFocus: boolean;
  configuration?: ThreadComposerConfiguration;
}> = ({ autoFocus, configuration }) => {
  const { Composer: ComposerComponent = Composer } = useContext(ThreadComponentsContext);
  return <ComposerComponent autoFocus={autoFocus} configuration={configuration} />;
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="滚动到最新消息"
        variant="outline"
        className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-md p-4 disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
      <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-medium tracking-tight duration-200">
        开始沟通
      </h1>
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions flex w-full flex-wrap items-center justify-center gap-2 px-4">
      <ThreadPrimitive.Suggestions>{() => <ThreadSuggestionItem />}</ThreadPrimitive.Suggestions>
    </div>
  );
};

const ThreadSuggestionItem: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200">
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion text-foreground hover:bg-muted border-border/60 h-auto gap-1.5 rounded-md border px-3.5 py-1.5 text-sm font-normal whitespace-nowrap transition-colors"
        >
          <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1" />
          <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 empty:hidden" />
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  );
};

const Composer: FC<{
  autoFocus: boolean;
  configuration?: ThreadComposerConfiguration;
}> = ({ autoFocus, configuration }) => {
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverRoot>
      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
        <ComposerPrimitive.AttachmentDropzone asChild>
          <div
            data-slot="aui_composer-shell"
            className="border-border/60 data-[dragging=true]:border-ring focus-within:border-ring/70 dark:border-muted-foreground/15 flex w-full cursor-text flex-col gap-1.5 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color] data-[dragging=true]:border-dashed data-[dragging=true]:bg-[color-mix(in_oklab,var(--color-accent)_50%,var(--color-background))]"
          >
            {configuration?.header}
            <ComposerAttachments />
            <ComposerLexicalInput
              placeholder={configuration?.placeholder ?? "输入消息，Enter 发送，Shift + Enter 换行"}
              formatter={configuration?.formatter}
              directiveChip={configuration?.directiveChip}
              hasTrigger={Boolean(configuration?.trigger)}
              onStopShortcut={configuration?.onStopShortcut}
              autoFocus={autoFocus}
            />
            {configuration?.actions ?? <ComposerAction />}
          </div>
        </ComposerPrimitive.AttachmentDropzone>
        {configuration?.trigger}
      </ComposerPrimitive.Root>
    </ComposerPrimitive.Unstable_TriggerPopoverRoot>
  );
};

const ComposerLexicalInput: FC<{
  autoFocus: boolean;
  directiveChip?: FC<DirectiveChipProps>;
  formatter?: Unstable_DirectiveFormatter;
  hasTrigger: boolean;
  placeholder: string;
  onStopShortcut?: () => void;
}> = ({ autoFocus, directiveChip, formatter, hasTrigger, placeholder, onStopShortcut }) => {
  const aui = useAui();
  const editorRef = useRef<HTMLDivElement>(null);
  const triggerAria = unstable_useTriggerPopoverAriaProps();

  useEffect(() => {
    const input = editorRef.current?.querySelector<HTMLElement>(".aui-lexical-input");
    if (!input) return;

    input.setAttribute("aria-label", "消息输入框");
    if (hasTrigger) input.setAttribute("aria-autocomplete", "list");
    else input.removeAttribute("aria-autocomplete");

    const attributes = {
      "aria-controls": triggerAria["aria-controls"],
      "aria-expanded": triggerAria["aria-expanded"]?.toString(),
      "aria-haspopup": triggerAria["aria-haspopup"],
      "aria-activedescendant": triggerAria["aria-activedescendant"],
    };

    for (const [name, value] of Object.entries(attributes)) {
      if (value === undefined) input.removeAttribute(name);
      else input.setAttribute(name, value);
    }
  }, [hasTrigger, triggerAria]);

  return (
    <LexicalComposerInput
      ref={editorRef}
      placeholder={placeholder}
      formatter={formatter}
      directiveChip={directiveChip}
      className="aui-composer-input caret-primary relative max-h-48 min-h-9 w-full overflow-y-auto bg-transparent px-2.5 py-1 text-sm leading-6 outline-none [&_.aui-lexical-input]:min-h-6 [&_.aui-lexical-input]:outline-none [&_.aui-lexical-placeholder]:pointer-events-none [&_.aui-lexical-placeholder]:absolute [&_.aui-lexical-placeholder]:inset-x-2.5 [&_.aui-lexical-placeholder]:top-1 [&_.aui-lexical-placeholder]:text-muted-foreground"
      autoFocus={autoFocus}
      onKeyDownCapture={(event) => {
        // Lexical's built-in Enter handler blocks submissions while a turn runs.
        // Keep mention selection, IME composition and multiline input with Lexical.
        if (triggerAria["aria-expanded"] || event.nativeEvent.isComposing || event.keyCode === 229)
          return;
        if (event.key === "Escape" && onStopShortcut && !event.repeat) {
          event.preventDefault();
          event.stopPropagation();
          onStopShortcut();
          return;
        }
        if (
          !aui.thread.getState().isRunning ||
          event.key !== "Enter" ||
          event.shiftKey ||
          event.altKey
        )
          return;
        event.preventDefault();
        event.stopPropagation();
        if (!aui.thread.getState().isDisabled && aui.composer.getState().canSend) {
          aui.composer.send();
        }
      }}
    />
  );
};

const ComposerAction: FC = () => {
  const aui = useAui();
  const canSend = useAuiState((s) => s.composer.canSend && !s.thread.isDisabled);
  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between">
      <AuiIf condition={(s) => s.thread.capabilities.attachments}>
        <ComposerAddAttachment />
      </AuiIf>
      <div className="ml-auto flex items-center gap-1.5">
        <AuiIf condition={(s) => s.thread.capabilities.dictation}>
          <AuiIf condition={(s) => s.composer.dictation == null}>
            <ComposerPrimitive.Dictate asChild>
              <TooltipIconButton
                tooltip="语音输入"
                side="bottom"
                type="button"
                variant="ghost"
                size="icon"
                className="aui-composer-dictate text-muted-foreground hover:text-foreground size-7 rounded-md"
                aria-label="开始语音输入"
              >
                <MicIcon className="aui-composer-dictate-icon size-4" />
              </TooltipIconButton>
            </ComposerPrimitive.Dictate>
          </AuiIf>
          <AuiIf condition={(s) => s.composer.dictation != null}>
            <ComposerPrimitive.StopDictation asChild>
              <TooltipIconButton
                tooltip="停止语音输入"
                side="bottom"
                type="button"
                variant="ghost"
                size="icon"
                className="aui-composer-stop-dictation text-destructive size-7 rounded-md"
                aria-label="停止语音输入"
              >
                <SquareIcon className="aui-composer-stop-dictation-icon size-3.5 animate-pulse fill-current" />
              </TooltipIconButton>
            </ComposerPrimitive.StopDictation>
          </AuiIf>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="aui-composer-cancel size-7 rounded-md"
              aria-label="停止成员执行"
            >
              <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
            </Button>
          </ComposerPrimitive.Cancel>
          {/* Core accepts messages during execution; Send's default running gate
              assumes a client queue. Reuse the Composer action without that gate. */}
          <TooltipIconButton
            tooltip="发送消息"
            side="bottom"
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-send size-7 rounded-md"
            aria-label="发送消息"
            disabled={!canSend}
            onClick={() => aui.composer.send()}
          >
            <ArrowUpIcon className="aui-composer-send-icon size-4" />
          </TooltipIconButton>
        </AuiIf>
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send asChild>
            <TooltipIconButton
              tooltip="发送消息"
              side="bottom"
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-send size-7 rounded-md"
              aria-label="发送消息"
            >
              <ArrowUpIcon className="aui-composer-send-icon size-4" />
            </TooltipIconButton>
          </ComposerPrimitive.Send>
        </AuiIf>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-2 rounded-md border p-3 text-sm dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

export const AssistantMessage: FC = () => {
  const {
    AssistantText,
    ToolFallback: ToolFallbackComponent = ToolFallback,
    groupBy,
    ActivityGroup,
    ToolGroup,
    ReasoningGroup,
    DataPart,
  } = useContext(ThreadComponentsContext);

  const ACTION_BAR_PT = "pt-1.5";
  // Keep the action bar inside the contained root's paint box, then cancel its reserved space in flow.
  const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="text-foreground px-2 leading-relaxed wrap-break-word"
      >
        <MessagePrimitive.GroupedParts
          groupBy={
            groupBy ??
            groupPartByType({
              reasoning: ["group-chainOfThought", "group-reasoning"],
              "tool-call": ["group-chainOfThought", "group-tool"],
              "standalone-tool-call": [],
            })
          }
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                if (ActivityGroup) return <ActivityGroup group={part}>{children}</ActivityGroup>;
                return <div data-slot="aui_chain-of-thought">{children}</div>;
              case "group-tool":
                if (ToolGroup) {
                  return <ToolGroup group={part}>{children}</ToolGroup>;
                }
                return (
                  <ToolGroupRoot variant="ghost">
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "group-reasoning": {
                if (ReasoningGroup) {
                  return <ReasoningGroup group={part}>{children}</ReasoningGroup>;
                }
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot streaming={running}>
                    <ReasoningTrigger active={running} />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "text":
                return AssistantText ? <AssistantText {...part} /> : <MarkdownText />;
              case "reasoning":
                return <Reasoning {...part} />;
              case "tool-call":
                return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "data":
                return DataPart ? (
                  <DataPart name={part.name} data={part.data} fallback={part.dataRendererUI} />
                ) : (
                  part.dataRendererUI
                );
              case "file":
                return (
                  <div data-slot="aui_assistant-message-file" className="py-1">
                    <File {...part} />
                  </div>
                );
              case "image":
                return (
                  <div data-slot="aui_assistant-message-image" className="py-1">
                    <MessageImage {...part} />
                  </div>
                );
              case "indicator":
                return (
                  <span
                    data-slot="aui_assistant-message-indicator"
                    className="animate-pulse font-sans"
                    aria-label="成员正在处理"
                  >
                    {"●"}
                  </span>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn("ms-2 flex items-center", ACTION_BAR_HEIGHT)}
      >
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  const { AssistantActions, AssistantMoreActions } = useContext(ThreadComponentsContext);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const pendingDialogRef = useRef<((restoreFocus: () => void) => void) | null>(null);
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200"
    >
      {AssistantActions ? <AssistantActions /> : null}
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="复制">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            ref={moreTriggerRef}
            tooltip="更多"
            className="data-[state=open]:bg-accent"
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          sideOffset={6}
          onCloseAutoFocus={(event) => {
            const openDialog = pendingDialogRef.current;
            pendingDialogRef.current = null;
            if (!openDialog) return;
            // Let the menu release its focus trap before the selected dialog takes focus.
            event.preventDefault();
            openDialog(() => moreTriggerRef.current?.focus());
          }}
          className="aui-action-bar-more-content bg-popover text-popover-foreground data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:animate-out data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 min-w-[8rem] overflow-hidden rounded-md border p-1.5"
        >
          {AssistantMoreActions ? (
            <AssistantMoreActions
              openDialog={(open) => {
                pendingDialogRef.current = open;
              }}
            />
          ) : null}
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm outline-none select-none">
              <DownloadIcon className="size-4" />
              导出 Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const UserFilePart: FileMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-file" className="py-1">
    <File {...part} />
  </div>
);

const UserImagePart: ImageMessagePartComponent = (part) => (
  <div data-slot="aui_user-message-image" className="py-1">
    <MessageImage {...part} />
  </div>
);

export const UserMessage: FC = () => {
  const { UserText } = useContext(ThreadComponentsContext);
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 animate-in relative flex flex-col gap-y-1 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative min-w-0">
        <div className="aui-user-message-content border-border/50 bg-card/70 text-foreground rounded-md border px-4 py-3 text-sm leading-6 wrap-break-word empty:hidden">
          <MessagePrimitive.Parts
            components={{
              ...(UserText ? { Text: UserText } : {}),
              File: UserFilePart,
              Image: UserImagePart,
            }}
          />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 flex w-full cursor-text flex-col rounded-(--composer-radius) border bg-(--composer-bg)">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" className="h-8 rounded-md px-3.5">
              取消
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" className="h-8 rounded-md px-3.5">
              更新
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};
