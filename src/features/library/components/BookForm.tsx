import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { bookSchema, type Book } from "../schemas";
import { createBook, updateBook } from "../api/books";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BookFormProps = {
  defaultValues?: Partial<Book>;
  onSuccess: () => void;
};

export function BookForm({ defaultValues, onSuccess }: BookFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Book>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      title: "",
      author: "",
      isbn: "",
      category: "",
      total_copies: 1,
      available_copies: 1,
      location: "",
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: isEditing ? updateBook : createBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success(isEditing ? "Book updated successfully" : "Book added to library successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record book");
    },
  });

  const onSubmit = (data: Book) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="title">Book Title</Label>
          <Input id="title" placeholder="The Great Gatsby" {...register("title")} />
          {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="author">Author</Label>
          <Input id="author" placeholder="F. Scott Fitzgerald" {...register("author")} />
          {errors.author && <p className="text-sm text-destructive">{errors.author.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="isbn">ISBN</Label>
          <Input id="isbn" placeholder="978-3-16-148410-0" {...register("isbn")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Category/Genre</Label>
          <Input id="category" placeholder="Fiction" {...register("category")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="total_copies">Total Copies</Label>
          <Input id="total_copies" type="number" {...register("total_copies")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="available_copies">Available Copies</Label>
          <Input id="available_copies" type="number" {...register("available_copies")} />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="location">Shelf/Location</Label>
          <Input id="location" placeholder="Aisle 3, Shelf B" {...register("location")} />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEditing ? "Update Book" : "Add Book"}
        </Button>
      </div>
    </form>
  );
}
