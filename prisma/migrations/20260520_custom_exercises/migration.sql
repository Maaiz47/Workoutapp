CREATE TABLE "CustomExercise" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "primaryMuscles" TEXT[],
    "secondaryMuscles" TEXT[],
    "equipment" TEXT[],
    "type" TEXT NOT NULL DEFAULT 'compound',
    "difficulty" TEXT NOT NULL DEFAULT 'intermediate',
    "photoUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomExercise_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomExercise_trainerId_idx" ON "CustomExercise"("trainerId");
ALTER TABLE "CustomExercise" ADD CONSTRAINT "CustomExercise_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
