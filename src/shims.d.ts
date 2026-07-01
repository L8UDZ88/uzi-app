// Module shims so the build type-checks the document extractors (loaded via dynamic import).
declare module "mammoth";
declare module "pdf-parse/lib/pdf-parse.js" {
  const parse: (data: Buffer) => Promise<{ text: string }>;
  export default parse;
}
