import type { ReactNode } from "react";

type Props = {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
};

export default function ErrorState({ title, body, action }: Props) {
  return (
    <div className="ob-error" role="alert">
      <h2 className="ob-error-title">{title}</h2>
      {body ? <p className="ob-error-body">{body}</p> : null}
      {action}
    </div>
  );
}
