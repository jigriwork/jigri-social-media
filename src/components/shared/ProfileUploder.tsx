import { useCallback, useState } from "react";
import { FileWithPath, useDropzone } from "react-dropzone";
import { convertFileToUrl } from "@/lib/utils";
import Cropper from "react-easy-crop";
import { Button } from "../ui/button";

type ProfileUploaderProps = {
  fieldChange: (files: File[]) => void;
  mediaUrl: string;
};

const ProfileUploader = ({ fieldChange, mediaUrl }: ProfileUploaderProps) => {
  const [file, setFile] = useState<File[]>([]);
  const [fileUrl, setFileUrl] = useState<string>(mediaUrl);
  const [errorMessage, setErrorMessage] = useState<string>('');
  
  // Cropper state
  const [showCropper, setShowCropper] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropConfirm = async () => {
    try {
      if (!file[0] || !croppedAreaPixels) return;

      const croppedImage = await getCroppedImg(fileUrl, croppedAreaPixels);
      if (croppedImage) {
        // Create a new File object from the blob
        const croppedFile = new File([croppedImage], file[0].name, {
          type: file[0].type,
        });

        fieldChange([croppedFile]);
        setFileUrl(URL.createObjectURL(croppedImage));
        setShowCropper(false);
      }
    } catch (e) {
      console.error(e);
      setErrorMessage("Failed to crop image. Please try again.");
    }
  };

  // Helper function to crop image
  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob | null> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.addEventListener("load", () => resolve(img));
      img.addEventListener("error", (error) => reject(error));
      img.src = imageSrc;
    });

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg", 0.9);
    });
  };

  const onDrop = useCallback(
    (acceptedFiles: FileWithPath[]) => {
      if (acceptedFiles && acceptedFiles.length > 0) {
        // If all files are valid, proceed
        console.log('Profile file is valid, processing...');
        setFile(acceptedFiles);
        setFileUrl(convertFileToUrl(acceptedFiles[0]));
        // Open cropper instead of calling fieldChange directly
        setShowCropper(true);
      }
    },
    [file]
  );

  const onDropRejected = useCallback(
    (rejectedFiles: any[]) => {
      console.log('Profile onDropRejected called with:', rejectedFiles);
      
      if (rejectedFiles && rejectedFiles.length > 0) {
        rejectedFiles.forEach((file) => {
          console.log('Rejected profile file:', file);
          if (file.errors) {
            file.errors.forEach((error: any) => {
              console.log('Profile file error:', error);
              if (error.code === 'file-invalid-type') {
                setErrorMessage('Invalid file type. Please upload PNG or JPG image.');
              } else {
                setErrorMessage('File upload error. Please try again.');
              }
            });
          }
        });
      }
    },
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    accept: {
      "image/jpeg": [".jpeg", ".jpg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
    },
    multiple: false, // Only allow one file
  });

  console.log('ProfileUploader rendered, isDragActive:', isDragActive);

  return (
    <div>
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500 rounded-lg">
          <p className="text-red-500 text-sm font-medium">{errorMessage}</p>
        </div>
      )}
      
      <div {...getRootProps()}>
        <input {...getInputProps()} className="cursor-pointer" />

        <div className="cursor-pointer flex-center gap-4">
          <img
            src={fileUrl || "/assets/icons/profile-placeholder.svg"}
            alt="image"
            className="h-24 w-24 rounded-full object-cover object-top"
          />
          <p className="text-primary-500 small-regular md:bbase-semibold">
            Change profile photo
          </p>
        </div>
      </div>

      {showCropper && fileUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <div className="bg-dark-2 rounded-2xl w-full max-w-lg overflow-hidden border border-dark-4 shadow-2xl">
            <div className="p-4 border-b border-dark-4 flex items-center justify-between">
              <h3 className="font-semibold text-light-1">Crop Profile Photo</h3>
              <button 
                onClick={() => setShowCropper(false)}
                className="text-light-4 hover:text-light-1 transition-colors"
              >
                ✕
              </button>
            </div>
            
            <div className="relative h-80 w-full bg-dark-1">
              <Cropper
                image={fileUrl}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape="round"
                showGrid={false}
              />
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-light-3">
                  <span>Zoom</span>
                  <span>{Math.round(zoom * 100)}%</span>
                </div>
                <input
                  type="range"
                  value={zoom}
                  min={1}
                  max={3}
                  step={0.1}
                  aria-labelledby="Zoom"
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="w-full h-1.5 bg-dark-4 rounded-lg appearance-none cursor-pointer accent-primary-500"
                />
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => setShowCropper(false)}
                  className="shad-button_dark_4 flex-1 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleCropConfirm}
                  className="shad-button_primary flex-1 rounded-xl"
                >
                  Apply Crop
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileUploader;
