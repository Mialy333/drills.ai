"""Bounded, in-memory text extraction; scanned/ambiguous PDFs use the existing model path."""
import asyncio
import io
import sys
from pathlib import Path


def read_text(data: bytes) -> str | None:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(data), strict=False)
    if reader.is_encrypted or not 1 <= len(reader.pages) <= 10:
        return None
    parts = []
    for page in reader.pages:
        content = page.get_contents()
        if content is None or len(content.get_data()) > 2_000_000:
            return None
        text = (page.extract_text() or "").strip()
        # A mostly image page, missing glyphs or scrambled text must not silently disappear.
        if len(text) < 40 or '\ufffd' in text or '(cid:' in text or sum(c.isalpha() for c in text) < len(text) * .3:
            return None
        parts.append(text)
    text = '\n\n'.join(parts)
    return text if 50 <= len(text) <= 16_000 else None


async def extract_pdf_text(data: bytes) -> str | None:
    # A separate process bounds parser CPU/memory and can be killed on cancellation.
    process = None
    try:
        process = await asyncio.create_subprocess_exec(sys.executable, str(Path(__file__).resolve()),
            stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL)
        output, _ = await asyncio.wait_for(process.communicate(data), timeout=4)
        text = output.decode('utf-8').strip()
        return text if process.returncode == 0 and 50 <= len(text) <= 16_000 else None
    except (OSError, ValueError, UnicodeError, asyncio.TimeoutError):
        return None
    finally:
        if process is not None and process.returncode is None:
            process.kill()
            await process.wait()


if __name__ == '__main__':
    try:
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (256 * 1024 * 1024, 256 * 1024 * 1024))
        resource.setrlimit(resource.RLIMIT_CPU, (3, 3))
        result = read_text(sys.stdin.buffer.read(4 * 1024 * 1024 + 1))
        if result:
            sys.stdout.write(result)
    except Exception:
        pass  # No PDF content or parser errors in server logs; caller uses model fallback.
