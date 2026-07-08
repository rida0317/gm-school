import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getGrades, deleteGrade } from "../api/grades";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { GradeForm } from "./GradeForm";
import type { Grade } from "../schemas";

export function GradesTable() {
  const queryClient = useQueryClient();
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);

  const { data: grades, isLoading } = useQuery({
    queryKey: ["grades"],
    queryFn: getGrades,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteGrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success("Grade record deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete grade");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading grades...</div>;
  }

  if (!grades?.length) {
    return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card mt-4">No grade records found.</div>;
  }

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student ID</TableHead>
            <TableHead>Subject</TableHead>
            <TableHead>Exam</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grades.map((grade) => {
            const percentage = (grade.score / grade.max_score) * 100;
            return (
            <TableRow key={grade.id}>
              <TableCell className="font-medium">{grade.student_id.substring(0, 8)}...</TableCell>
              <TableCell>{grade.subject_name}</TableCell>
              <TableCell>{grade.exam_name}</TableCell>
              <TableCell>
                <span className={`font-semibold ${percentage >= 50 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {grade.score} / {grade.max_score}
                </span>
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Dialog open={!!editingGrade && editingGrade.id === grade.id} onOpenChange={(open) => !open && setEditingGrade(null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setEditingGrade(grade)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Grade Record</DialogTitle>
                    </DialogHeader>
                    {editingGrade && editingGrade.id === grade.id && (
                      <GradeForm defaultValues={editingGrade} onSuccess={() => setEditingGrade(null)} />
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this grade record?")) {
                      deleteMutation.mutate(grade.id!);
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
