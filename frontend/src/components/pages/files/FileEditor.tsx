import { lazy, Suspense } from "react";
import { Spinner } from "../../ui/Spinner.tsx";

const MonacoEditor = lazy(() => import("@monaco-editor/react"));

export function FileEditor({ value, language = "plaintext" }: { value: string; language?: string }) {
  return (
    <Suspense fallback={<Spinner label="Loading editor" />}>
      <MonacoEditor height="60vh" language={language} value={value} theme={document.documentElement.classList.contains("dark") ? "vs-dark" : "vs-light"} options={{ readOnly: false, minimap: { enabled: false } }} />
    </Suspense>
  );
}
