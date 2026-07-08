import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { teacherSchema, type Teacher } from "../schemas";
import { createTeacher, updateTeacher } from "../api/teachers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type TeacherFormProps = {
  defaultValues?: Partial<Teacher>;
  onSuccess: () => void;
};

export function TeacherForm({ defaultValues, onSuccess }: TeacherFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Teacher>({
    resolver: zodResolver(teacherSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      max_hours_per_week: 0,
      is_vacataire: false,
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: isEditing ? updateTeacher : createTeacher,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["teachers"] });
      toast.success(isEditing ? "Teacher updated successfully" : "Teacher created successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save teacher");
    },
  });

  const onSubmit = (data: Teacher) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">Full Name</Label>
          <Input id="name" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
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
          <Label htmlFor="max_hours_per_week">Max Hours / Week</Label>
          <Input id="max_hours_per_week" type="number" {...register("max_hours_per_week")} />
        </div>
        
        <div className="space-y-2 flex items-center pt-8 space-x-2">
          <input
            type="checkbox"
            id="is_vacataire"
            {...register("is_vacataire")}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="is_vacataire" className="cursor-pointer">
            Is Vacataire (Part-time)
          </Label>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEditing ? "Update Teacher" : "Create Teacher"}
        </Button>
      </div>
    </form>
  );
}
