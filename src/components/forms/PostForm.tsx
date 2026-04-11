"use client";

import * as z from "zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { PostValidation } from "@/lib/validation";
import { useToast } from "@/components/ui/use-toast";
import { useUserContext } from "@/context/SupabaseAuthContext";
import FileUploader from "../shared/FileUploader";
import Loader from "../shared/Loader";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Textarea } from "../ui";
import { useCreatePost, useUpdatePost } from "@/lib/react-query/queriesAndMutations";
import { POST_CATEGORIES } from "@/constants";
import { useMentions } from "@/hooks/useMentions";
import MentionsDropdown from "../shared/MentionsDropdown";

const normalizeTagInput = (value: string) =>
  value
    .split(/[,\s]+/)
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean)
    .join(" ");

type PostFormProps = {
  post?: any; // TODO: Add proper Supabase Post type
  action: "Create" | "Update";
};

const PostForm = ({ post, action }: PostFormProps) => {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useUserContext();
  const form = useForm<z.infer<typeof PostValidation>>({
    resolver: zodResolver(PostValidation),
    defaultValues: {
      caption: post ? post?.caption : "",
      file: [],
      location: post ? post.location : "",
      tags: post ? (Array.isArray(post.tags) ? post.tags.join(",") : post.tags || "") : "",
      category: post ? post.category : "general",
    },
  });

  // Query
  const { mutateAsync: createPost, isPending: isLoadingCreate } =
    useCreatePost();
  const { mutateAsync: updatePost, isPending: isLoadingUpdate } =
    useUpdatePost();

  // Mentions
  const mentions = useMentions();

  // Handler
  const handleSubmit = async (value: z.infer<typeof PostValidation>) => {
    console.log('PostForm - Current user:', user)
    console.log('PostForm - User ID:', user?.id)
    
    if (!user?.id) {
      toast({
        title: "Authentication required. Please login again.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      // ACTION = UPDATE
      if (post && action === "Update") {
        const updatedPost = await updatePost({
          ...value,
          location: value.location?.trim() || "",
          tags: normalizeTagInput(value.tags),
          postId: post.id,
          imageUrl: post.image_url,
        });

        if (!updatedPost) {
          toast({
            title: `${action} post failed. Please try again.`,
          });
          return;
        }
        
        toast({
          title: `Post ${action.toLowerCase()}d successfully!`,
        });
        return router.push(`/posts/${post.id}`);
      }

      // ACTION = CREATE
      console.log('PostForm - About to create post with userId:', user.id)
      const newPost = await createPost({
        ...value,
        location: value.location?.trim() || "",
        tags: normalizeTagInput(value.tags),
        userId: user.id,
      });

      if (!newPost) {
        toast({
          title: `${action} post failed. Please try again.`,
        });
        return;
      }
      
      toast({
        title: `Post ${action.toLowerCase()}d successfully!`,
      });
      router.push("/");
    } catch (error) {
      console.error(`Error ${action.toLowerCase()}ing post:`, error);
      toast({
        title: `${action} post failed. Please try again.`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="bg-dark-2 w-full max-w-5xl rounded-[24px] p-6 lg:p-10 border border-dark-4 shadow-xl mb-10">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="flex flex-col gap-9 w-full">
          <div className="flex gap-4 items-start w-full">
            <img
              src={user?.image_url || "/assets/icons/profile-placeholder.svg"}
              alt="creator"
              className="w-12 h-12 rounded-full mt-2 hidden sm:block"
            />
            <FormField
              control={form.control}
              name="caption"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel className="shad-form_label">What's on your mind?</FormLabel>
                  <FormControl>
                    <div className="relative w-full">
                      <Textarea
                        placeholder="Write your note or post here. Share a thought, announcement, or ask a question..."
                        className="shad-textarea custom-scrollbar border-dark-4 bg-dark-3 focus-visible:ring-primary-500 text-lg p-4"
                        style={{ height: '140px', minHeight: '140px' }}
                        {...field}
                        onChange={(e) => {
                          field.onChange(e);
                          mentions.handleTextChange(e, e.target.value);
                        }}
                      />
                      <MentionsDropdown
                        isVisible={mentions.isDropdownVisible}
                        users={mentions.searchResults || []}
                        isFetching={mentions.isFetching}
                        onClose={mentions.closeDropdown}
                        onSelect={(username) => {
                          const newText = mentions.insertMention(username, field.value);
                          field.onChange(newText);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage className="shad-form_message" />
                </FormItem>
              )}
            />
          </div>

        <FormField
          control={form.control}
          name="file"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">Add Photo (Optional)</FormLabel>
              <FormControl>
                <FileUploader
                  fieldChange={field.onChange}
                  mediaUrl={post?.imageUrl}
                />
              </FormControl>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">Add Location (Optional)</FormLabel>
              <FormControl>
                <Input placeholder="City, place, or event" type="text" className="shad-input" {...field} />
              </FormControl>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="tags"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">
                Hashtags
              </FormLabel>
              <FormControl>
                <Input
                  placeholder="#art #expression #learn or art expression learn"
                  type="text"
                  className="shad-input"
                  {...field}
                />
              </FormControl>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label mb-3 block">Category</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-3">
                  {POST_CATEGORIES.map((category) => (
                    <button
                      type="button"
                      key={category.value}
                      onClick={() => field.onChange(category.value)}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                        field.value === category.value 
                          ? 'bg-primary-500 text-light-1 shadow-lg shadow-primary-500/20 scale-105' 
                          : 'bg-dark-4 text-light-3 hover:bg-dark-3 hover:text-light-2'
                      }`}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>
              </FormControl>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />

        <div className="flex gap-4 items-center justify-end pt-8 mt-4 border-t border-dark-4">
          <Button
            type="button"
            variant="ghost"
            className="hover:bg-dark-4 text-light-2 px-6"
            onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="shad-button_primary whitespace-nowrap px-8 rounded-full"
            disabled={isLoadingCreate || isLoadingUpdate}>
            {(isLoadingCreate || isLoadingUpdate) && <Loader />}
            {action === "Create" ? "Publish" : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
    </div>
  );
};

export default PostForm;
