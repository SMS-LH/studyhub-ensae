import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Maximize2, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, fileUrl } from "@/lib/api";

const CodeView = ({ text }) => (
  <div className="font-mono text-[13px] leading-6 bg-slate-950 text-slate-100 rounded-xl overflow-auto max-h-[75vh]">
    <table className="min-w-full">
      <tbody>
        {text.split("\n").map((line, i) => (
          <tr key={i}>
            <td className="select-none text-right pr-4 pl-4 text-slate-500 w-12 align-top">
              {i + 1}
            </td>
            <td className="pr-4 whitespace-pre">{line || " "}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const SlidesView = ({ text }) => {
  const slides = text
    .split(/--- Diapositive \d+ ---/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="space-y-4 max-h-[75vh] overflow-auto pr-1">
      {slides.map((s, i) => (
        <div
          key={i}
          className="aspect-[16/9] max-h-80 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 shadow-sm flex flex-col"
        >
          <div className="text-xs font-mono text-amber-700 mb-2">
            Diapositive {i + 1}
          </div>
          <div className="font-display text-xl font-bold text-slate-900">
            {s.split("\n")[0]}
          </div>
          <div className="text-sm text-slate-600 mt-3 whitespace-pre-line overflow-hidden">
            {s.split("\n").slice(1).join("\n")}
          </div>
        </div>
      ))}
    </div>
  );
};

const PaperView = ({ text }) => (
  <article className="bg-white border border-slate-200 rounded-xl px-6 sm:px-12 py-10 max-h-[75vh] overflow-auto shadow-sm">
    {text
      .split("\n")
      .filter((l) => l.trim())
      .map((l, i) => (
        <p
          key={i}
          className={`mb-3 leading-relaxed ${l.length < 80 && !/[.:;]$/.test(l) ? "font-display font-bold text-lg text-slate-900 mt-5" : "text-slate-700"}`}
        >
          {l}
        </p>
      ))}
  </article>
);

const NoPreview = ({ url, filename }) => (
  <div className="surface p-10 text-center">
    <FileWarning className="mx-auto text-slate-400 mb-2" />
    <p className="text-sm text-slate-600">
      Aperçu indisponible pour cette version. Télécharge le fichier pour le
      consulter.
    </p>
    <Button asChild variant="outline" className="mt-4 rounded-full">
      <a href={url} download={filename}>
        <Download size={14} className="mr-2" /> Télécharger
      </a>
    </Button>
  </div>
);

export const DocViewer = ({ doc, entry }) => {
  const ref = useRef(null);
  const [text, setText] = useState(null);
  const isCurrent = entry.version === doc.current_version;
  const url = fileUrl(doc.id, entry.version);
  const ext = entry.filename.split(".").pop().toLowerCase();
  const fmt = isCurrent
    ? doc.format
    : {
        pdf: "pdf",
        mp4: "video",
        webm: "video",
        mov: "video",
        docx: "word",
        pptx: "powerpoint",
      }[ext] || "code";

  useEffect(() => {
    setText(null);
    if (fmt === "code" || fmt === "texte") {
      api
        .get(`/documents/${doc.id}/file`, {
          params: { version: entry.version },
          responseType: "text",
          transformResponse: (d) => d,
        })
        .then((r) => setText(r.data))
        .catch(() => setText(""));
    }
  }, [doc.id, entry.version, fmt]);

  let body;
  if (fmt === "pdf")
    body = (
      <iframe
        data-testid="pdf-viewer-frame"
        title={doc.title}
        src={url}
        className="w-full h-[75vh] rounded-xl border border-slate-200 bg-white"
      />
    );
  else if (fmt === "video")
    body = (
      <video
        data-testid="video-player"
        controls
        src={url}
        className="w-full rounded-xl bg-black max-h-[75vh]"
      />
    );
  else if (fmt === "code" || fmt === "texte")
    body =
      text === null ? (
        <div className="py-20 grid place-items-center">
          <Loader2 className="animate-spin text-primary" />
        </div>
      ) : fmt === "code" ? (
        <CodeView text={text} />
      ) : (
        <PaperView text={text} />
      );
  else if (isCurrent && doc.text_content)
    body =
      fmt === "powerpoint" ? (
        <SlidesView text={doc.text_content} />
      ) : (
        <PaperView text={doc.text_content} />
      );
  else body = <NoPreview url={url} filename={entry.filename} />;

  return (
    <div
      data-testid="document-viewer-container"
      ref={ref}
      className="bg-slate-100 rounded-2xl p-3 sm:p-4 border border-slate-200"
    >
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-mono text-slate-500 truncate">
          {entry.filename} · V{entry.version}
        </span>
        <Button
          variant="ghost"
          size="sm"
          data-testid="viewer-fullscreen-button"
          onClick={() => ref.current?.requestFullscreen?.()}
        >
          <Maximize2 size={14} className="mr-1" /> Plein écran
        </Button>
      </div>
      {body}
    </div>
  );
};
