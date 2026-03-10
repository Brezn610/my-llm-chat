'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

type Props = { text: string };

/** 将模型常用的 \( \) 和 \[ \] 转为 remark-math 支持的 $ 和 $$ */
function normalizeMathDelimiters(raw: string): string {
  return raw
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');
}

/**
 * 助手消息内容：Markdown + 数学公式渲染。
 * 后续若要加代码高亮、表格样式、Mermaid 等，在此组件内扩展即可。
 */
export function AssistantMessageContent({ text }: Props) {
  const normalized = normalizeMathDelimiters(text);
  return (
    <div className="chat-markdown [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5 [&_strong]:font-semibold break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}
