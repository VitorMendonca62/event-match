import { RegistrationError } from '../errors/registration.error';

const BOM = String.fromCharCode(0xfeff);
const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;

/**
 * Published legal artifact (ADR-028): the stored text is the complete Markdown file, digest and all.
 * Clients receive only the body, without the frontmatter used for publishing metadata.
 */
export class LegalDocumentText {
  private constructor(readonly body: string) {}

  static fromArtifact(markdown: string): LegalDocumentText {
    const withoutBom = markdown.startsWith(BOM) ? markdown.slice(1) : markdown;
    let body = withoutBom;
    if (/^---[ \t]*\r?\n/.test(withoutBom)) {
      const match = FRONTMATTER.exec(withoutBom);
      if (!match) throw new RegistrationError('INVALID_LEGAL_DOCUMENT');
      body = withoutBom.slice(match[0].length);
    }
    const trimmed = body.trimStart();
    if (trimmed.trim().length === 0) throw new RegistrationError('INVALID_LEGAL_DOCUMENT');
    return new LegalDocumentText(trimmed);
  }
}
