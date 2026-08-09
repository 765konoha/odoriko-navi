import { Fragment } from "react";

// https:// で始まる文字列は改行までを1つのURLとみなし、
// 「外部リンク」表記のハイパーリンクに変換して表示する
// (長いURLがカード幅からはみ出すのを防ぐ)。
const URL_PATTERN = /(https?:\/\/[^\n]+)/g;

export default function AnnouncementBody({
  body,
  className,
}: {
  body: string;
  className?: string;
}) {
  const segments = body.split(URL_PATTERN);

  return (
    <p className={`break-words whitespace-pre-wrap ${className ?? ""}`}>
      {segments.map((segment, i) =>
        /^https?:\/\//.test(segment) ? (
          <a
            key={i}
            href={segment.trim()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-blue-700 underline"
          >
            🔗外部リンク
          </a>
        ) : (
          <Fragment key={i}>{segment}</Fragment>
        ),
      )}
    </p>
  );
}
