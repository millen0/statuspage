import { useState, useRef } from 'react';
import { useThemeStore } from '../contexts/themeStore';

export default function RichTextEditor({ value, onChange }) {
  const theme = useThemeStore((state) => state.theme);
  const editorRef = useRef(null);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    editorRef.current?.focus();
  };

  const insertLink = () => {
    if (linkUrl) {
      execCommand('createLink', linkUrl);
      setLinkUrl('');
      setShowLinkModal(false);
    }
  };

  const handleInput = () => {
    onChange(editorRef.current.innerHTML);
  };

  const colors = ['#000000', '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e'];

  return (
    <div className={theme === 'dark' ? 'border border-[#30363d] rounded-md' : 'border border-gray-300 rounded-md'}>
      <div className={theme === 'dark' ? 'flex flex-wrap gap-1 p-2 border-b border-[#30363d] bg-[#0d1117]' : 'flex flex-wrap gap-1 p-2 border-b border-gray-300 bg-gray-50'}>
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className={theme === 'dark' ? 'px-3 py-1 rounded hover:bg-[#30363d] text-white font-bold' : 'px-3 py-1 rounded hover:bg-gray-200 font-bold'}
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className={theme === 'dark' ? 'px-3 py-1 rounded hover:bg-[#30363d] text-white italic' : 'px-3 py-1 rounded hover:bg-gray-200 italic'}
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className={theme === 'dark' ? 'px-3 py-1 rounded hover:bg-[#30363d] text-white underline' : 'px-3 py-1 rounded hover:bg-gray-200 underline'}
          title="Underline"
        >
          U
        </button>
        <div className="w-px bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={() => setShowLinkModal(true)}
          className={theme === 'dark' ? 'px-3 py-1 rounded hover:bg-[#30363d] text-white' : 'px-3 py-1 rounded hover:bg-gray-200'}
          title="Insert Link"
        >
          🔗
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className={theme === 'dark' ? 'px-3 py-1 rounded hover:bg-[#30363d] text-white' : 'px-3 py-1 rounded hover:bg-gray-200'}
            title="Text Color"
          >
            🎨
          </button>
          {showColorPicker && (
            <div className={theme === 'dark' ? 'absolute top-full mt-1 p-2 bg-[#161b22] border border-[#30363d] rounded shadow-lg z-10' : 'absolute top-full mt-1 p-2 bg-white border border-gray-300 rounded shadow-lg z-10'}>
              <div className="grid grid-cols-4 gap-1">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      execCommand('foreColor', color);
                      setShowColorPicker(false);
                    }}
                    className="w-6 h-6 rounded border border-gray-300"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="w-px bg-gray-300 mx-1"></div>
        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className={theme === 'dark' ? 'px-3 py-1 rounded hover:bg-[#30363d] text-white' : 'px-3 py-1 rounded hover:bg-gray-200'}
          title="Bullet List"
        >
          • List
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className={theme === 'dark' ? 'px-3 py-1 rounded hover:bg-[#30363d] text-white' : 'px-3 py-1 rounded hover:bg-gray-200'}
          title="Numbered List"
        >
          1. List
        </button>
      </div>

      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        dangerouslySetInnerHTML={{ __html: value }}
        className={theme === 'dark' ? 'p-3 min-h-[120px] bg-[#0d1117] text-white focus:outline-none' : 'p-3 min-h-[120px] bg-white focus:outline-none'}
        style={{ wordWrap: 'break-word' }}
      />

      {showLinkModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className={theme === 'dark' ? 'bg-[#161b22] border border-[#30363d] rounded-lg p-6 w-96' : 'bg-white rounded-lg p-6 w-96 shadow-xl'}>
            <h3 className={theme === 'dark' ? 'text-lg font-medium text-white mb-4' : 'text-lg font-medium mb-4'}>Insert Link</h3>
            <input
              type="url"
              placeholder="https://example.com"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className={theme === 'dark' ? 'w-full px-3 py-2 bg-[#0d1117] border border-[#30363d] rounded text-white' : 'w-full px-3 py-2 border border-gray-300 rounded'}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={insertLink}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Insert
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLinkModal(false);
                  setLinkUrl('');
                }}
                className={theme === 'dark' ? 'flex-1 px-4 py-2 bg-[#30363d] text-white rounded hover:bg-[#484f58]' : 'flex-1 px-4 py-2 bg-gray-200 rounded hover:bg-gray-300'}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
