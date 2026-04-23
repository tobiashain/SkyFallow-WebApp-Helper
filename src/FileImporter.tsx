import { useState, type ChangeEvent, type DragEvent } from "react";

interface FileImporterProps<T> {
  onDataLoaded: (data: T) => void;
  label?: string;
  accept?: string;
}

export function FileImporter<T>({
  onDataLoaded,
  label,
  accept = ".json",
}: FileImporterProps<T>) {
  const [fileName, setFileName] = useState<string>("");

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        if (typeof e.target?.result === "string") {
          const json = JSON.parse(e.target.result) as T;
          onDataLoaded(json);
        }
      } catch {
        alert("Invalid JSON file");
      }
    };
    reader.readAsText(file);
  };

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) handleFile(e.target.files[0]);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const onDragOver = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
  };

  return (
    <label
      onDrop={onDrop}
      onDragOver={onDragOver}
      style={{
        border: "2px dashed #aaa",
        padding: "1rem",
        display: "block",
        cursor: "pointer",
      }}
    >
      {label || "Drop JSON file here or click to browse"}
      <input type="file" accept={accept} onChange={onInputChange} hidden />
      {fileName && <p>Loaded: {fileName}</p>}
    </label>
  );
}
