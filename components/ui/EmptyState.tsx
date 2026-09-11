import type { ReactNode } from "react";

type Props = {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
};

export default function EmptyState({ title, body, action }: Props) {
  return (
    <div className="ob-empty" role="status">
      <div className="ob-empty-mark" aria-hidden="true" />
      <h2 className="ob-empty-title">{title}</h2>
      {body ? <p className="ob-empty-body">{body}</p> : null}
      {action}
    </div>
  );
}
