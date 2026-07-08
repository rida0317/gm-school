import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getTeachers, deleteTeacher } from "../api/teachers";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TeacherForm } from "./TeacherForm";
import type { Teacher } from "../schemas";

export function TeachersTable() {
  const queryClient = useQueryClient();
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  const { data: teachers, isLoading } = useQuery({
    queryKey: ["teachers"],
    queryFn: getTeachers,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTeacher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success("Teacher deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete teacher");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading teachers...</div>;
  }

  if (!teachers?.length) {
    return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card mt-4">No teachers found. Add one to get started!</div>;
  }

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {teachers.map((teacher) => (
            <TableRow key={teacher.id}>
              <TableCell className="font-medium">{teacher.name}</TableCell>
              <TableCell>{teacher.email || "-"}</TableCell>
              <TableCell>{teacher.phone || "-"}</TableCell>
              <TableCell>
                {teacher.is_vacataire ? (
                  <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-medium dark:bg-blue-900 dark:text-blue-200">
                    Vacataire
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium dark:bg-green-900 dark:text-green-200">
                    Permanent
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Dialog open={!!editingTeacher && editingTeacher.id === teacher.id} onOpenChange={(open) => !open && setEditingTeacher(null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setEditingTeacher(teacher)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Teacher</DialogTitle>
                    </DialogHeader>
                    {editingTeacher && editingTeacher.id === teacher.id && (
                      <TeacherForm defaultValues={editingTeacher} onSuccess={() => setEditingTeacher(null)} />
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this teacher?")) {
                      deleteMutation.mutate(teacher.id!);
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
