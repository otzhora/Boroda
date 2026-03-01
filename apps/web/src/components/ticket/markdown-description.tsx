import { memo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface MarkdownDescriptionProps {
  value: string;
}

const proseClassName =
  "markdown-description min-w-0 text-sm leading-6 text-ink-100 [&_*]:min-w-0 [&_a]:text-ink-50 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-white/15 [&_blockquote]:pl-4 [&_blockquote]:text-ink-200 [&_code]:rounded-md [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_h1]:m-0 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:m-0 [&_h3]:text-base [&_h3]:font-semibold [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-white/10 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-white/10 [&_img]:bg-black/20 [&_img]:shadow-sm [&_li>input]:mr-2 [&_li>input]:mt-1 [&_li>input]:h-4 [&_li>input]:w-4 [&_li>input]:shrink-0 [&_li>input]:rounded-[4px] [&_li>input]:border-white/20 [&_li>input]:bg-white/[0.03] [&_li>input]:p-0 [&_li>input]:align-top [&_p]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_tbody_td]:border-t [&_tbody_td]:border-white/10 [&_tbody_td]:px-3 [&_tbody_td]:py-2 [&_td]:align-top [&_th]:bg-white/[0.04] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_thead]:border-b [&_thead]:border-white/10";

function joinClassNames(...values: Array<string | undefined>) {
  return values.filter(Boolean).join(" ");
}

export const MarkdownDescription = memo(function MarkdownDescription({ value }: MarkdownDescriptionProps) {
  return (
    <div className={proseClassName}>
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          img: ({ node: _node, ...props }) => <img {...props} loading="lazy" />,
          input: ({ node: _node, className, type, ...props }) => {
            if (type === "checkbox") {
              return (
                <input
                  {...props}
                  type="checkbox"
                  className={joinClassNames(
                    "mr-2 mt-1 h-4 w-4 shrink-0 rounded-[4px] border-white/20 bg-white/[0.03] p-0 align-top",
                    className
                  )}
                />
              );
            }

            return <input {...props} type={type} className={className} />;
          },
          ol: ({ node: _node, className, ...props }) => (
            <ol {...props} className={joinClassNames("m-0 list-outside list-decimal pl-6", className)} />
          ),
          ul: ({ node: _node, className, ...props }) => {
            const isTaskList = className?.includes("contains-task-list");

            return (
              <ul
                {...props}
                className={joinClassNames(isTaskList ? "m-0 list-none pl-0" : "m-0 list-outside list-disc pl-6", className)}
              />
            );
          },
          li: ({ node: _node, className, ...props }) => {
            const isTaskListItem = className?.includes("task-list-item");

            return (
              <li
                {...props}
                className={joinClassNames(
                  isTaskListItem ? "flex items-start gap-2 list-none" : undefined,
                  "min-w-0",
                  className
                )}
              />
            );
          }
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
});
