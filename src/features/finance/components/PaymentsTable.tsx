import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getPayments, deletePayment } from "../api/payments";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { PaymentForm } from "./PaymentForm";
import type { Payment } from "../schemas";

export function PaymentsTable() {
  const queryClient = useQueryClient();
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: getPayments,
  });

  const deleteMutation = useMutation({
    mutationFn: deletePayment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      toast.success("Payment record deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete payment");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading payments...</div>;
  }

  if (!payments?.length) {
    return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card mt-4">No payment records found.</div>;
  }

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Student ID</TableHead>
            <TableHead>Month</TableHead>
            <TableHead>Amount Paid</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="font-medium">{payment.student_id.substring(0, 8)}...</TableCell>
              <TableCell>{payment.month}/{payment.academic_year}</TableCell>
              <TableCell>${payment.paid_amount}</TableCell>
              <TableCell>
                {payment.status === "Paid" ? (
                  <span className="px-2 py-1 rounded-full bg-green-100 text-green-800 text-xs font-medium dark:bg-green-900 dark:text-green-200">
                    Paid
                  </span>
                ) : payment.status === "Pending" ? (
                  <span className="px-2 py-1 rounded-full bg-yellow-100 text-yellow-800 text-xs font-medium dark:bg-yellow-900 dark:text-yellow-200">
                    Pending
                  </span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-red-100 text-red-800 text-xs font-medium dark:bg-red-900 dark:text-red-200">
                    Overdue
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Dialog open={!!editingPayment && editingPayment.id === payment.id} onOpenChange={(open) => !open && setEditingPayment(null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setEditingPayment(payment)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Payment Record</DialogTitle>
                    </DialogHeader>
                    {editingPayment && editingPayment.id === payment.id && (
                      <PaymentForm defaultValues={editingPayment} onSuccess={() => setEditingPayment(null)} />
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this payment record?")) {
                      deleteMutation.mutate(payment.id!);
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
