#!/usr/bin/env python3
"""Generate Spiral 6 capability map JSON from structured XML taxonomy exports.

The visual poster source is `_c3_import/spiral6/C3_Taxonomy_Baseline_6_Poster_(A3).pdf`.
Because the PDF is not machine-friendly, this generator derives the same poster
hierarchy from the accompanying Spiral 6 XML taxonomy exports in `_c3_import/spiral6/`.
"""

from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from collections import deque
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = PROJECT_ROOT / "_c3_import" / "spiral6"
OUTPUT_PATH = PROJECT_ROOT / "shared" / "c3" / "capability-map-spiral6.json"
DOMAIN_CONFIG_PATH = PROJECT_ROOT / "shared" / "c3" / "capability-map-domain-config.json"

NS = {
    "a": "http://www.opengroup.org/xsd/archimate/3.0/",
    "xsi": "http://www.w3.org/2001/XMLSchema-instance",
}

CODE_PATTERN = re.compile(r"/([A-Z]{2}-\d+)$")

DOMAIN_SOURCES = [
    ("BusinessProcesses", "20221208_Business_Processes_Taxonomy.xml"),
    ("BusinessRoles", "20221208_Business_Roles_Taxonomy.xml"),
    ("COIServices", "20221208_COI_Services_Taxonomy.xml"),
    ("CommunicationsServices", "20221208_Communications_Services_Taxonomy.xml"),
    ("CoreServices", "20221208_Core_Services_Taxonomy.xml"),
    ("UserApplications", "20221208_User_Applications_Taxonomy.xml"),
]


def text_value(node: ET.Element | None) -> str | None:
    if node is None or node.text is None:
        return None
    value = node.text.strip()
    return value or None


def load_domain_order() -> dict[str, int]:
    with DOMAIN_CONFIG_PATH.open("r", encoding="utf-8") as handle:
        rows = json.load(handle)
    return {row["code"]: int(row["sort_order"]) for row in rows}


def extract_page_id(url: str | None) -> str | None:
    if not url:
        return None
    match = CODE_PATTERN.search(url.strip())
    return match.group(1) if match else None


def collect_properties(element: ET.Element) -> dict[str, str]:
    values: dict[str, str] = {}
    for prop in element.findall("./a:properties/a:property", NS):
        key = prop.attrib.get("propertyDefinitionRef")
        value = text_value(prop.find("a:value", NS))
        if key and value:
            values[key] = value
    return values


def load_domain_items(domain_code: str, filename: str) -> list[dict[str, object]]:
    tree = ET.parse(SOURCE_DIR / filename)
    root = tree.getroot()

    nodes_by_identifier: dict[str, dict[str, object]] = {}
    children_by_parent: dict[str, list[str]] = {}
    parent_by_child: dict[str, str] = {}

    for element in root.findall("./a:elements/a:element", NS):
        properties = collect_properties(element)
        page_id = extract_page_id(properties.get("propid-45"))
        uuid = properties.get("propid-40") or properties.get("propid-50")
        title = text_value(element.find("a:name", NS))
        if not page_id or not uuid or not title:
            continue

        nodes_by_identifier[element.attrib["identifier"]] = {
            "pageId": page_id,
            "uuid": uuid,
            "title": title,
            "parentId": None,
            "level": None,
            "state": "approved",
            "domain": domain_code,
        }

    for relation in root.findall("./a:relationships/a:relationship", NS):
        relation_type = relation.attrib.get(f"{{{NS['xsi']}}}type")
        if relation_type not in {"Aggregation", "Composition"}:
            continue

        source = relation.attrib.get("source")
        target = relation.attrib.get("target")
        if not source or not target:
            continue
        if source not in nodes_by_identifier or target not in nodes_by_identifier:
            continue

        parent_by_child[target] = source
        children_by_parent.setdefault(source, []).append(target)

    roots: list[str] = []
    for identifier, node in nodes_by_identifier.items():
        parent_identifier = parent_by_child.get(identifier)
        if not parent_identifier:
            roots.append(identifier)
            continue
        node["parentId"] = nodes_by_identifier[parent_identifier]["pageId"]

    queue: deque[tuple[str, int]] = deque(sorted((identifier, 1) for identifier in roots))
    visited: set[str] = set()
    while queue:
        identifier, level = queue.popleft()
        if identifier in visited:
            continue
        visited.add(identifier)
        nodes_by_identifier[identifier]["level"] = level
        for child_identifier in sorted(
            children_by_parent.get(identifier, []),
            key=lambda child_id: str(nodes_by_identifier[child_id]["title"]).casefold(),
        ):
            queue.append((child_identifier, level + 1))

    result = list(nodes_by_identifier.values())
    for item in result:
        if item["level"] is None:
            item["level"] = 1

    return result


def main() -> None:
    domain_order = load_domain_order()
    items: list[dict[str, object]] = []

    for domain_code, filename in DOMAIN_SOURCES:
        items.extend(load_domain_items(domain_code, filename))

    items.sort(
        key=lambda item: (
            domain_order.get(str(item["domain"]), 999),
            int(item["level"]),
            str(item["parentId"] or ""),
            str(item["title"]).casefold(),
            str(item["pageId"]),
        )
    )

    OUTPUT_PATH.write_text(
        json.dumps(items, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_PATH} ({len(items)} rows)")


if __name__ == "__main__":
    main()
