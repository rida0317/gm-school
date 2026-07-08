import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { paymentSchema, type Payment } from "../schemas";
import { createPayment, updatePayment } from "../api/payments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type PaymentFormProps = {
  defaultValues?: Partial<Payment>;
  onSuccess: () => void;
};

export function PaymentForm({ defaultValues, onSuccess }: PaymentFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!defaultValues?.id;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Payment>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      student_id: "",
      academic_year: "2026/2027",
      month: new Date().getMonth() + 1,
      base_amount: 0,
      transport_amount: 0,
      discount: 0,
      paid_amount: 0,
      status: "Paid",
      payment_method: "Cash",
      ...defaultValues,
    },
  });

  const mutation = useMutation({
    mutationFn: isEditing ? updatePayment : createPayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success(isEditing ? "Payment updated successfully" : "Payment recorded successfully");
      onSuccess();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  const onSubmit = (data: Payment) => {
    mutation.mutate({ ...data, school_id: "default-school" }); // Provide a mock school id for now
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
          <Label htmlFor="academic_year">Academic Year</Label>
          <Input id="academic_year" {...register("academic_year")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="month">Month (1-12)</Label>
          <Input id="month" type="number" {...register("month")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="base_amount">Base Amount</Label>
          <Input id="base_amount" type="number" {...register("base_amount")} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="paid_amount">Paid Amount</Label>
          <Input id="paid_amount" type="number" {...register("paid_amount")} />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="status">Status</Label>
          <select
            id="status"
            {...register("status")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="Paid">Paid</option>
            <option value="Pending">Pending</option>
            <option value="Overdue">Overdue</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="payment_method">Payment Method</Label>
          <Input id="payment_method" {...register("payment_method")} />
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving..." : isEditing ? "Update Payment" : "Record Payment"}
        </Button>
      </div>
    </form>
  );
}
