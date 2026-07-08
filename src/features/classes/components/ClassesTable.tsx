import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getClasses, deleteClass } from "../api/classes";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ClassForm } from "./ClassForm";
import type { Class } from "../schemas";

export function ClassesTable() {
  const queryClient = useQueryClient();
  const [editingClass, setEditingClass] = useState<Class | null>(null);

  const { data: classes, isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: getClasses,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Class deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete class");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading classes...</div>;
  }

  if (!classes?.length) {
    return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card mt-4">No classes found. Add one to get started!</div>;
  }

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Class Name</TableHead>
            <TableHead>Level</TableHead>
            <TableHead>Max Students</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {classes.map((cls) => (
            <TableRow key={cls.id}>
              <TableCell className="font-medium">{cls.name}</TableCell>
              <TableCell>{cls.level || "-"}</TableCell>
              <TableCell>{cls.max_students}</TableCell>
              <TableCell>
                {cls.is_active ? (
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium dark:bg-green-900 dark:text-green-200">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium dark:bg-red-900 dark:text-red-200">
                    Inactive
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Dialog open={!!editingClass && editingClass.id === cls.id} onOpenChange={(open) => !open && setEditingClass(null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setEditingClass(cls)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Class</DialogTitle>
                    </DialogHeader>
                    {editingClass && editingClass.id === cls.id && (
                      <ClassForm defaultValues={editingClass} onSuccess={() => setEditingClass(null)} />
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this class?")) {
                      deleteMutation.mutate(cls.id!);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
