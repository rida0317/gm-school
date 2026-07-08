import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getBooks, deleteBook } from "../api/books";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BookForm } from "./BookForm";
import type { Book } from "../schemas";

export function BooksTable() {
  const queryClient = useQueryClient();
  const [editingBook, setEditingBook] = useState<Book | null>(null);

  const { data: books, isLoading } = useQuery({
    queryKey: ["books"],
    queryFn: getBooks,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      toast.success("Book deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete book");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading library catalog...</div>;
  }

  if (!books?.length) {
    return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card mt-4">No books found in the catalog.</div>;
  }

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Availability</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {books.map((book) => {
            const isAvailable = book.available_copies > 0;
            return (
            <TableRow key={book.id}>
              <TableCell className="font-medium">{book.title}</TableCell>
              <TableCell>{book.author}</TableCell>
              <TableCell>{book.category || "-"}</TableCell>
              <TableCell>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${isAvailable ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'}`}>
                  {book.available_copies} / {book.total_copies}
                </span>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Dialog open={!!editingBook && editingBook.id === book.id} onOpenChange={(open) => !open && setEditingBook(null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setEditingBook(book)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Book Details</DialogTitle>
                    </DialogHeader>
                    {editingBook && editingBook.id === book.id && (
                      <BookForm defaultValues={editingBook} onSuccess={() => setEditingBook(null)} />
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to remove this book from the catalog?")) {
                      deleteMutation.mutate(book.id!);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          )})}
        </TableBody>
      </Table>
    </div>
  );
}
