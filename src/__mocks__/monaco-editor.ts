// Mock for monaco-editor in Jest tests
export const editor = {
  create: jest.fn(),
  defineTheme: jest.fn(),
  setTheme: jest.fn(),
  createModel: jest.fn(),
  getModels: jest.fn(() => []),
  onDidCreateModel: jest.fn(),
  onWillDisposeModel: jest.fn(),
};

export const languages = {
  register: jest.fn(),
  setMonarchTokensProvider: jest.fn(),
  setLanguageConfiguration: jest.fn(),
  registerCompletionItemProvider: jest.fn(),
};

export const Uri = {
  parse: jest.fn(),
  file: jest.fn(),
};

export const KeyMod = {};
export const KeyCode = {};

const monacoEditor = {
  editor,
  languages,
  Uri,
  KeyMod,
  KeyCode,
};

export default monacoEditor;
