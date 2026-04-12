"use client";

import { useEffect, useMemo, useState } from "react";
import { useCreateStory } from "@/lib/react-query/queriesAndMutations";

type CreateStoryModalProps = {
    open: boolean;
    onClose: () => void;
};

const CreateStoryModal = ({ open, onClose }: CreateStoryModalProps) => {
    const [file, setFile] = useState<File | null>(null);
    const [caption, setCaption] = useState("");
    const [error, setError] = useState<string | null>(null);
    const { mutateAsync: createStory, isPending } = useCreateStory();

    const previewUrl = useMemo(() => {
        if (!file) return "";
        return URL.createObjectURL(file);
    }, [file]);

    useEffect(() => {
        return () => {
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    useEffect(() => {
        if (!open) {
            setFile(null);
            setCaption("");
            setError(null);
        }
    }, [open]);

    if (!open) return null;

    const isVideo = file?.type.startsWith("video/");

    const onSubmit = async () => {
        if (!file) {
            setError("Please select an image or video.");
            return;
        }

        setError(null);
        try {
            await createStory({ file, caption: caption.trim() || undefined });
            onClose();
        } catch (e: any) {
            setError(e?.message || "Failed to post story.");
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center">
            <div className="w-full md:max-w-xl bg-dark-2 border border-dark-4 rounded-t-2xl md:rounded-2xl p-4 md:p-6 max-h-[95vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-light-1 text-lg font-semibold">Create Story</h3>
                    <button onClick={onClose} className="text-light-3 hover:text-light-1">✕</button>
                </div>

                {!file ? (
                    <label className="flex flex-col items-center justify-center border border-dashed border-dark-4 rounded-xl p-8 cursor-pointer bg-dark-3/30">
                        <input
                            type="file"
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => {
                                const selected = e.target.files?.[0] || null;
                                setFile(selected);
                            }}
                        />
                        <p className="text-light-2 font-medium">Upload image or video</p>
                        <p className="text-light-4 text-sm mt-1">No edits in v1. Keep it raw.</p>
                    </label>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-dark-4 bg-black">
                            {isVideo ? (
                                <video src={previewUrl} controls className="w-full max-h-[55vh] object-contain" preload="metadata" />
                            ) : (
                                <img src={previewUrl} alt="Story preview" className="w-full max-h-[55vh] object-contain" loading="lazy" />
                            )}
                        </div>

                        <textarea
                            placeholder="Add a caption (optional)"
                            className="w-full bg-dark-3 border border-dark-4 rounded-xl p-3 text-sm text-light-1 outline-none"
                            rows={3}
                            maxLength={180}
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                        />

                        <button
                            type="button"
                            onClick={() => setFile(null)}
                            className="text-xs text-light-3 hover:text-light-1"
                        >
                            Choose another file
                        </button>
                    </div>
                )}

                {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

                <div className="mt-5 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-dark-4 text-light-2">Cancel</button>
                    <button
                        onClick={onSubmit}
                        disabled={isPending}
                        className="px-4 py-2 text-sm rounded-lg bg-primary-500 text-white disabled:opacity-60"
                    >
                        {isPending ? "Posting..." : "Post Story"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateStoryModal;
