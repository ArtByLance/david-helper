# Book Cover Migration - 2026-06-04

Original `assets/media/books/covers/*.jpg` files were preserved here when active
book media moved to one folder per book.

Current production book media lives at:

```text
assets/media/books/<book-id>/<book-id>-book-cover.jpg
assets/media/books/<book-id>/<book-id>-book-opener.jpg
assets/media/books/<book-id>/<book-id>-chapter-1.jpg
assets/media/books/<book-id>/<book-id>-chapter-2.jpg
```

The `-book-cover.jpg` file is the editable cover image shown on the shelf.
It was initially duplicated from the current `-chapter-1.jpg` image so new cover
art can be pasted over it without disturbing chapter images.

The `-book-opener.jpg` file restores the original cover art as the reader's
opening image. Chapter images use `-chapter-N.jpg` so they stay aligned with
their chapters.
