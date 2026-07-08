import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { gradeSchema, type Grade } from "../schemas";
import { createGrade, updateGrade } from "../api/grades";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GradeFormProps = {
  defaultValues?: Partial<Grade>;
  onSuccess: () => void;
};

export function GradeForm({ defaultValues, onSuccess }: GradeFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Grade>({
    resolver: zodResolver(gradeSchema),
    defaultValues: {
      student_id: "",
      subject_name: "",
      exam_name: "Midterm",
      score: 0,
      max_score: 20,
      comments: "",
      exam_date: new Date().toISOString().split('T')[0],
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: isEditing ? updateGrade : createGrade,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      toast.success(isEditing ? "Grade updated successfully" : "Grade recorded successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record grade");
    },
  });

  const onSubmit = (data: Grade) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="student_id">Student ID</Label>
          <Input id="student_id" placeholder="Student UUID" {...register("student_id")} />
          {errors.student_id && <p className="text-sm text-destructive">{errors.student_id.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="subject_name">Subject</Label>
          <Input id="subject_name" placeholder="Mathematics" {...register("subject_name")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="exam_name">Exam/Test Name</Label>
          <Input id="exam_name" placeholder="Midterm Exam" {...register("exam_name")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="score">Score</Label>
          <Input id="score" type="number" step="0.25" {...register("score")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_score">Out Of (Max Score)</Label>
          <Input id="max_score" type="number" {...register("max_score")} />
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="comments">Teacher Comments</Label>
          <Input id="comments" placeholder="Great improvement..." {...register("comments")} />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEditing ? "Update Grade" : "Record Grade"}
        </Button>
      </div>
    </form>
  );
}
