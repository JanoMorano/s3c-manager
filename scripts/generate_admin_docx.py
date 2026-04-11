#!/usr/bin/env python3
from generate_documentation_docx import DOCS, write_docx


if __name__ == "__main__":
    for spec in DOCS:
        if spec.output.name == "service-catalog-admin-dokumentace.docx":
            write_docx(spec)
            break
