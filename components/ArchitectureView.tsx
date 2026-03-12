import React, { useState } from 'react';
import { CPP_FILES } from '../constants';

export const ArchitectureView: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState(CPP_FILES[0]);

  return (
    <div className="flex h-full bg-canvas border border-white/10 rounded-lg overflow-hidden font-mono text-sm">
      {/* File Explorer */}
      <div className="w-64 border-r border-white/10 flex flex-col bg-surface-idle">
        <div className="p-4 text-text-data text-xs uppercase tracking-wider border-b border-white/5">
          Source Explorer
        </div>
        <div className="flex-1 overflow-y-auto py-2">
          {CPP_FILES.map((file) => (
            <button
              key={file.name}
              onClick={() => setSelectedFile(file)}
              className={`w-full text-left px-4 py-3 text-xs transition-colors truncate
                ${selectedFile.name === file.name 
                  ? 'bg-surface-active text-text-primary border-l-2 border-text-primary' 
                  : 'text-text-secondary hover:bg-surface-active/50 border-l-2 border-transparent'}`}
            >
              {file.name}
              <div className="text-[10px] text-text-data mt-1 opacity-60">{file.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Code Viewer */}
      <div className="flex-1 flex flex-col bg-[#0b0b0b]">
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-surface-idle">
          <span className="text-text-primary">{selectedFile.name}</span>
          <span className="text-text-data text-xs px-2 py-1 rounded bg-white/5">{selectedFile.language}</span>
        </div>
        <div className="flex-1 overflow-auto p-6">
          <pre className="text-text-secondary font-mono leading-relaxed whitespace-pre-wrap">
            <code>{selectedFile.content}</code>
          </pre>
        </div>
      </div>
    </div>
  );
};