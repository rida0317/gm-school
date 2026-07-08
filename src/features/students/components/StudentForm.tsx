import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { studentSchema, type Student } from "../schemas";
import { createStudent, updateStudent } from "../api/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type StudentFormProps = {
  defaultValues?: Partial<Student>;
  onSuccess: () => void;
};

export function StudentForm({ defaultValues, onSuccess }: StudentFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Student>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      name: "",
      code_massar: "",
      email: "",
      phone: "",
      gender: "Male",
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: isEditing ? updateStudent : createStudent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast.success(isEditing ? "Student updated successfully" : "Student created successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save student");
    },
  });

  const onSubmit = (data: Student) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="code_massar">Massar Code</Label>
          <Input id="code_massar" {...register("code_massar")} />
          {errors.code_massar && <p className="text-sm text-destructive">{errors.code_massar.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" {...register("phone")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="gender">Gender</Label>
          <select
            id="gender"
            {...register("gender")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEditing ? "Update Student" : "Create Student"}
        </Button>
      </div>
    </form>
  );
}
