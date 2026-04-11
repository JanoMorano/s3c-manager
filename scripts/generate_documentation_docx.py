#!/usr/bin/env python3
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "output" / "doc"


@dataclass(frozen=True)
class DocSpec:
    source: Path
    output: Path
    title: str
    subject: str
    description: str
    keywords: str


DOCS = [
    DocSpec(
        source=ROOT / "docs" / "user-guide.md",
        output=OUTPUT_DIR / "service-catalog-user-dokumentace.docx",
        title="Service Catalogue User Guide",
        subject="User documentation",
        description="User documentation for the Service Catalogue application.",
        keywords="service catalogue,user,guide,c3,taxonomy",
    ),
    DocSpec(
        source=ROOT / "docs" / "admin-guide.md",
        output=OUTPUT_DIR / "service-catalog-admin-dokumentace.docx",
        title="Service Catalogue Admin Guide",
        subject="Administrator documentation",
        description="Administrator documentation for the Service Catalogue application.",
        keywords="service catalogue,admin,guide,c3,taxonomy",
    ),
]


def run(text: str, *, bold: bool = False, code: bool = False) -> str:
    props = []
    if bold:
        props.append("<w:b/>")
    if code:
        props.append(
            "<w:rFonts w:ascii=\"Consolas\" w:hAnsi=\"Consolas\" w:eastAsia=\"Consolas\"/>"
            "<w:sz w:val=\"20\"/>"
        )
    prop_xml = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    space = " xml:space=\"preserve\"" if text[:1].isspace() or text[-1:].isspace() else ""
    return f"<w:r>{prop_xml}<w:t{space}>{escape(text)}</w:t></w:r>"


def paragraph(text: str, *, style: str | None = None, code: bool = False) -> str:
    ppr = []
    if style:
        ppr.append(f"<w:pStyle w:val=\"{style}\"/>")
    if code:
        ppr.append("<w:spacing w:after=\"40\"/>")
    ppr_xml = f"<w:pPr>{''.join(ppr)}</w:pPr>" if ppr else ""
    return f"<w:p>{ppr_xml}{run(text, code=code)}</w:p>"


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Aptos" w:hAnsi="Aptos" w:eastAsia="Aptos"/>
        <w:sz w:val="22"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
    <w:pPrDefault>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
    </w:pPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="120" w:after="180"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="34"/><w:color w:val="17324D"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="Heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="220" w:after="120"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="17324D"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="Heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="24"/><w:color w:val="30516E"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="Heading 3"/>
    <w:basedOn w:val="Normal"/>
    <w:qFormat/>
    <w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="3F627F"/></w:rPr>
  </w:style>
</w:styles>
"""


def content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""


def root_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""


def document_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""


def core_xml(now: datetime, spec: DocSpec) -> str:
    iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>{escape(spec.title)}</dc:title>
  <dc:subject>{escape(spec.subject)}</dc:subject>
  <dc:creator>OpenAI Codex</dc:creator>
  <cp:keywords>{escape(spec.keywords)}</cp:keywords>
  <dc:description>{escape(spec.description)}</dc:description>
  <cp:lastModifiedBy>OpenAI Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{iso}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{iso}</dcterms:modified>
</cp:coreProperties>
"""


def app_xml(spec: DocSpec) -> str:
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Microsoft Office Word</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Title</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>1</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="1" baseType="lpstr">
      <vt:lpstr>{escape(spec.title)}</vt:lpstr>
    </vt:vector>
  </TitlesOfParts>
  <Company>Internal</Company>
  <LinksUpToDate>false</LinksUpToDate>
  <SharedDoc>false</SharedDoc>
  <HyperlinksChanged>false</HyperlinksChanged>
  <AppVersion>1.0</AppVersion>
</Properties>
"""


HEADING_RE = re.compile(r"^(#{1,3})\s+(.*)$")
ORDERED_RE = re.compile(r"^(\d+)\.\s+(.*)$")


def parse_markdown(source: Path) -> list[str]:
    elements: list[str] = []
    paragraph_buffer: list[str] = []
    code_buffer: list[str] = []
    in_code_block = False

    def flush_paragraph() -> None:
        nonlocal paragraph_buffer
        if paragraph_buffer:
            elements.append(paragraph(" ".join(paragraph_buffer).strip()))
            paragraph_buffer = []

    def flush_code() -> None:
        nonlocal code_buffer
        if code_buffer:
            for line in code_buffer:
                elements.append(paragraph(line if line else " ", code=True))
            code_buffer = []

    for raw in source.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        stripped = line.strip()

        if stripped.startswith("```"):
            flush_paragraph()
            if in_code_block:
                flush_code()
            in_code_block = not in_code_block
            continue

        if in_code_block:
            code_buffer.append(line)
            continue

        if not stripped:
            flush_paragraph()
            continue

        heading = HEADING_RE.match(stripped)
        if heading:
            flush_paragraph()
            level = len(heading.group(1))
            text = heading.group(2).strip()
            style = {1: "Title", 2: "Heading1", 3: "Heading2"}.get(level, "Heading3")
            elements.append(paragraph(text, style=style))
            continue

        ordered = ORDERED_RE.match(stripped)
        if ordered:
            flush_paragraph()
            elements.append(paragraph(f"{ordered.group(1)}. {ordered.group(2).strip()}"))
            continue

        if stripped.startswith("- "):
            flush_paragraph()
            elements.append(paragraph(f"• {stripped[2:].strip()}"))
            continue

        paragraph_buffer.append(stripped)

    flush_paragraph()
    flush_code()
    return elements


def build_document_xml(spec: DocSpec) -> str:
    body = parse_markdown(spec.source)
    sect = (
        "<w:sectPr>"
        "<w:pgSz w:w=\"11906\" w:h=\"16838\"/>"
        "<w:pgMar w:top=\"1080\" w:right=\"1080\" w:bottom=\"1080\" w:left=\"1080\" "
        "w:header=\"708\" w:footer=\"708\" w:gutter=\"0\"/>"
        "</w:sectPr>"
    )
    return (
        "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
        "<w:document xmlns:w=\"http://schemas.openxmlformats.org/wordprocessingml/2006/main\">"
        "<w:body>"
        + "".join(body)
        + sect
        + "</w:body></w:document>"
    )


def write_docx(spec: DocSpec) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    now = datetime.now(timezone.utc)
    with ZipFile(spec.output, "w", compression=ZIP_DEFLATED) as archive:
        archive.writestr("[Content_Types].xml", content_types_xml())
        archive.writestr("_rels/.rels", root_rels_xml())
        archive.writestr("word/document.xml", build_document_xml(spec))
        archive.writestr("word/styles.xml", styles_xml())
        archive.writestr("word/_rels/document.xml.rels", document_rels_xml())
        archive.writestr("docProps/core.xml", core_xml(now, spec))
        archive.writestr("docProps/app.xml", app_xml(spec))


def generate_all() -> None:
    for spec in DOCS:
        write_docx(spec)


if __name__ == "__main__":
    generate_all()
