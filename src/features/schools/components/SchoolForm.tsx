import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { schoolSchema, type School } from "../schemas";
import { createSchool, updateSchool } from "../api/schools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SchoolFormProps = {
  defaultValues?: Partial<School>;
  onSuccess: () => void;
};

export function SchoolForm({ defaultValues, onSuccess }: SchoolFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<School>({
    resolver: zodResolver(schoolSchema),
    defaultValues: {
      name: "",
      address: "",
      contact_number: "",
      principal_name: "",
      is_active: true,
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: isEditing ? updateSchool : createSchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success(isEditing ? "School updated successfully" : "School created successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to save school");
    },
  });

  const onSubmit = (data: School) => {
    mutation.mutate(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">School Name</Label>
          <Input id="name" placeholder="e.g. Springfield High" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        <div className="space-y-2 col-span-2">
          <Label htmlFor="address">Address</Label>
          <Input id="address" {...register("address")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact_number">Contact Number</Label>
          <Input id="contact_number" {...register("contact_number")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="principal_name">Principal Name</Label>
          <Input id="principal_name" {...register("principal_name")} />
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
          {mutation.isPending ? "Saving..." : isEditing ? "Update School" : "Create School"}
        </Button>
      </div>
    </form>
  );
}
