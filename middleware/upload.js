const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const { dataDir } = require("../config/appConfig");

const uploadDir = path.join(dataDir, "uploads");
const TYPES = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

// Random file names; the extension comes from the checked type, never the user
const photoUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      fs.mkdirSync(uploadDir, { recursive: true });
      cb(null, uploadDir);
    },
    filename: (req, file, cb) =>
      cb(null, crypto.randomBytes(16).toString("hex") + TYPES[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (req, file, cb) => {
    // Say so instead of silently saving the update without its photo (e.g. iPhone HEIC)
    if (!TYPES[file.mimetype])
      req.uploadError = "Only JPG, PNG or WebP photos are allowed.";
    cb(null, Boolean(TYPES[file.mimetype]));
  },
}).single("photo");

// The browser-sent type can lie; check the file's first bytes too
function isRealImage(filePath) {
  const head = Buffer.alloc(12);
  const fd = fs.openSync(filePath, "r");
  fs.readSync(fd, head, 0, 12, 0);
  fs.closeSync(fd);

  return (
    (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) || // JPEG
    head
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) || // PNG
    (head.subarray(0, 4).toString() === "RIFF" &&
      head.subarray(8, 12).toString() === "WEBP")
  );
}

// Wraps multer so a too-big or broken upload becomes a form error
function handlePhoto(req, res, next) {
  photoUpload(req, res, (error) => {
    if (error) {
      req.uploadError =
        error.code === "LIMIT_FILE_SIZE"
          ? "Photo must be smaller than 5 MB."
          : "Photo could not be uploaded.";
      return next();
    }

    if (req.file && !isRealImage(req.file.path)) {
      fs.unlinkSync(req.file.path);
      req.file = null;
      req.uploadError = "Only JPG, PNG or WebP photos are allowed.";
    }

    return next();
  });
}

function sendUpload(req, res, next) {
  const name = String(req.params.file || "");
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(name)) return next();

  res.set("Cache-Control", "public, max-age=604800");
  return res.sendFile(name, { root: uploadDir }, (error) => error && next());
}

module.exports = { handlePhoto, sendUpload, uploadDir };
