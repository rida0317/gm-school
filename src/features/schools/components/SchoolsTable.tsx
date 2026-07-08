import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getSchools, deleteSchool } from "../api/schools";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SchoolForm } from "./SchoolForm";
import type { School } from "../schemas";

export function SchoolsTable() {
  const queryClient = useQueryClient();
  const [editingSchool, setEditingSchool] = useState<School | null>(null);

  const { data: schools, isLoading } = useQuery({
    queryKey: ["schools"],
    queryFn: getSchools,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSchool,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["schools"] });
      toast.success("School deleted successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete school");
    },
  });

  if (isLoading) {
    return <div className="p-8 text-center text-muted-foreground">Loading schools...</div>;
  }

  if (!schools?.length) {
    return <div className="p-8 text-center text-muted-foreground border rounded-lg bg-card mt-4">No schools found. Add one to get started!</div>;
  }

  return (
    <div className="rounded-md border mt-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>School Name</TableHead>
            <TableHead>Principal</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {schools.map((school) => (
            <TableRow key={school.id}>
              <TableCell className="font-medium">{school.name}</TableCell>
              <TableCell>{school.principal_name || "-"}</TableCell>
              <TableCell>{school.contact_number || "-"}</TableCell>
              <TableCell>
                {school.is_active ? (
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
                <Dialog open={!!editingSchool && editingSchool.id === school.id} onOpenChange={(open) => !open && setEditingSchool(null)}>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={() => setEditingSchool(school)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit School</DialogTitle>
                    </DialogHeader>
                    {editingSchool && editingSchool.id === school.id && (
                      <SchoolForm defaultValues={editingSchool} onSuccess={() => setEditingSchool(null)} />
                    )}
                  </DialogContent>
                </Dialog>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    if (window.confirm("Are you sure you want to delete this school?")) {
                      deleteMutation.mutate(school.id!);
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
