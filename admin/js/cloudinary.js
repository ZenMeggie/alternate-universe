import { CLOUDINARY_CLOUD_NAME, CLOUDINARY_UPLOAD_PRESET } from "./config.js";

function assertConfig() {
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) throw new Error("Isi CLOUDINARY_CLOUD_NAME dan CLOUDINARY_UPLOAD_PRESET di config.js");
}

export async function uploadToCloudinary(file, folder) {
  assertConfig();
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  if (folder) fd.append("folder", folder);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Upload Cloudinary gagal");
  return { url: data.secure_url, publicId: data.public_id };
}

export async function uploadAudio(file, folder = "story-audio") {
  assertConfig();
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
  fd.append("folder", folder);
  // Cloudinary menyimpan audio di jalur "video"
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/video/upload`, { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Upload audio gagal");
  return data.secure_url;
}

export function pickAudio() {
  return new Promise(resolve => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "audio/*";
    input.onchange = () => resolve(input.files?.[0] || null);
    input.click();
  });
}
