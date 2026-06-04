# Book Cover Migration - 2026-06-04

Original `assets/media/books/covers/*.jpg` files were preserved here when active
book media moved to one folder per book.

Current production book media lives at:

```text
assets/media/books/<book-id>/<book-id>-0.jpg
assets/media/books/<book-id>/<book-id>-1.jpg
assets/media/books/<book-id>/<book-id>-2.jpg
```

The `-0.jpg` file is the editable cover image shown on the shelf and title page.
It was initially duplicated from the current `-1.jpg` chapter image so new cover
art can be pasted over it without disturbing chapter images.
