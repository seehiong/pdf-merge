# MergeDocs | Premium PDF Merger & Organizer

🔗 **Live Demo**: [https://seehiong.github.io/pdf-merge/](https://seehiong.github.io/pdf-merge/)

A sleek, secure, and entirely client-side PDF merging and page organization utility. Combine multiple PDF files, insert images, rotate pages, reorder layouts, and stamp page numbers directly in your browser without any server-side processing.

---

## 🚀 Features

- **Premium UI**: Modern dark-mode/light-mode interface with responsive glassmorphism, clean transitions, and animations.
- **Security First**: Merging happens entirely in your local browser sandbox. Your files are never uploaded to any remote server.
- **Interactive Page Organizer**: Switch from File Manager to the organizer grid to view page-by-page thumbnails of your documents.
- **Individual Page Controls**:
  - Drag-and-drop to reorder individual pages.
  - Delete specific pages from the merge sequence.
  - Rotate pages in increments of 90° (both clockwise and counter-clockwise).
- **Import Images**: Seamlessly combine PNG, JPEG, and JPG images along with your PDFs into a single, merged PDF file.
- **Page Number Stamping**: Automatically stamp page numbers with customizable formatting ("Page X", "Page X of Y"), positions (header/footer, left/center/right), sizes, and colors.
- **Password-Protected PDFs**: Detects encrypted PDFs and prompts with a secure, glassmorphic modal to unlock them client-side.

---

## 🛠️ Built With

- **HTML5 & Vanilla CSS**: Dynamic grid layout, responsive design, custom variables, and transition animations.
- **Native JavaScript (ES6)**: Tab switching, state synchronization, sequential file loading, and color syncing.
- **[pdf-lib](https://pdf-lib.js.org/)**: Client-side PDF copy/paste page streams, page-number drawing, rotation, and compiler.
- **[pdf.js](https://mozilla.github.io/pdf.js/)**: Mozilla's rendering engine for generating high-fidelity page preview thumbnails inside `<canvas>` tags.

---

## 📖 How to Use

1. Open `index.html` in any modern web browser, or host it on GitHub Pages.
2. Drag and drop your PDFs and images into the upload area.
3. If any PDF is password-protected, enter the passcode when prompted to unlock it.
4. **File Manager Tab**: Reorder the input documents as a whole or remove them.
5. **Page Organizer Tab**: Hover over page cards to rotate, delete, or drag them to fine-tune the final layout.
6. **Page Numbers Settings**: Toggle page numbers, select formatting, colors, position, and sizing.
7. Click **Merge & Download** to download the combined document instantly.

---

## 📄 License

This project is open-source and available for use under the MIT License.
