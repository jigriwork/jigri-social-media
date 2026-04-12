"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "../components/AppLayout";
import { useUserContext } from "../../src/context/SupabaseAuthContext";

export default function ProfileIndexPage() {
    const router = useRouter();
    const { user, isLoading } = useUserContext();

    useEffect(() => {
        if (isLoading) return;

        if (user?.id) {
            router.replace(`/profile/${user.id}`);
            return;
        }

        router.replace("/sign-in");
    }, [isLoading, router, user?.id]);

    return (
        <AppLayout>
            <div className="profile-container">
                <p className="text-light-4">Loading profile...</p>
            </div>
        </AppLayout>
    );
}
