import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { classSchema, type Class } from "../schemas";
import { createClass, updateClass } from "../api/classes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ClassFormProps = {
  defaultValues?: Partial<Class>;
  onSuccess: () => void;
};

export function ClassForm({ defaultValues, onSuccess }: ClassFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Class>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: "",
      level: "",
      room_id: "",
      teacher_id: "",
      max_students: 30,
      is_active: true,
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: isEditing ? updateClass : createClass,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success(isEditing ? "Class updated successfully" : "Class created successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save class");
    },
  });

  const onSubmit = (data: Class) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">Class Name</Label>
          <Input id="name" placeholder="e.g. 10A" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="level">Level</Label>
          <Input id="level" placeholder="e.g. High School" {...register("level")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_students">Max Students</Label>
          <Input id="max_students" type="number" {...register("max_students")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="room_id">Room ID (Optional)</Label>
          <Input id="room_id" placeholder="Room 101" {...register("room_id")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="teacher_id">Main Teacher ID (Optional)</Label>
          <Input id="teacher_id" placeholder="Teacher UUID" {...register("teacher_id")} />
        </div>
        
        <div className="space-y-2 flex items-center pt-8 space-x-2">
          <input
            type="checkbox"
            id="is_active"
            {...register("is_active")}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="is_active" className="cursor-pointer">
            Is Active
          </Label>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEditing ? "Update Class" : "Create Class"}
        </Button>
      </div>
    </form>
  );
}
