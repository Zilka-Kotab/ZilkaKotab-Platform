"""Build the approved vector footer without retaining hidden source-page content.

Usage: python artifacts/zilka-kotab/scripts/build-handout-footer.py original.pdf
Requires PyMuPDF; only the footer, portrait, and unchanged QR survive.
"""
import argparse
from pathlib import Path
import pymupdf


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    args = parser.parse_args()
    source = pymupdf.open(args.source)
    page = source[0]
    # Cropping alone merely hides content: PDF text extraction still sees it.
    # Remove all company/event metrics before embedding the shared footer.
    page.add_redact_annot(pymupdf.Rect(0, 0, 612, 429.5), fill=(1, 1, 1))
    # Both tools supply their own native question text; retain the vector icons.
    page.add_redact_annot(pymupdf.Rect(55, 459, 579, 540), fill=(1, 1, 1))
    page.apply_redactions(images=0, graphics=2, text=0)
    footer = pymupdf.open()
    target = footer.new_page(width=612, height=362.5)
    target.show_pdf_page(target.rect, source, 0, clip=pymupdf.Rect(0, 429.5, 612, 792))
    assert "Miovision" not in target.get_text()
    assert "Marcus Evans" not in target.get_text()
    destination = Path(__file__).resolve().parents[1] / "src/assets/firm-handout-footer.pdf"
    footer.save(destination, garbage=4, deflate=True)
    print(f"Built {destination}")


if __name__ == "__main__":
    main()
