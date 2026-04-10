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
import { Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui";
import { useCreatePost, useUpdatePost } from "@/lib/react-query/queriesAndMutations";
import { POST_CATEGORIES } from "@/constants";

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
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-9 w-full  max-w-5xl">
        <FormField
          control={form.control}
          name="caption"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="shad-form_label">Post Text</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Write your post here. You can publish text only, or add a photo too."
                  className="shad-textarea custom-scrollbar"
                  style={{ height: '120px', minHeight: '120px' }}
                  {...field}
                />
              </FormControl>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />

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
              <FormLabel className="shad-form_label">Category *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="shad-input">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {POST_CATEGORIES.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage className="shad-form_message" />
            </FormItem>
          )}
        />

        <div className="flex gap-4 items-center justify-end pt-6 pb-8 mb-6">
          <Button
            type="button"
            className="shad-button_dark_4"
            onClick={() => router.back()}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="shad-button_primary whitespace-nowrap"
            disabled={isLoadingCreate || isLoadingUpdate}>
            {(isLoadingCreate || isLoadingUpdate) && <Loader />}
            {action} Post
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default PostForm;
