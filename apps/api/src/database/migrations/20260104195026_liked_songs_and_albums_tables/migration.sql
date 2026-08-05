/*
  Warnings:

  - You are about to drop the column `userId` on the `Album` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Song` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Album" DROP CONSTRAINT "Album_userId_fkey";

-- DropForeignKey
ALTER TABLE "Song" DROP CONSTRAINT "Song_userId_fkey";

-- AlterTable
ALTER TABLE "Album" DROP COLUMN "userId";

-- AlterTable
ALTER TABLE "Song" DROP COLUMN "userId";

-- CreateTable
CREATE TABLE "LikedSong" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LikedSong_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LikedAlbum" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LikedAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LikedSong_userId_idx" ON "LikedSong"("userId");

-- CreateIndex
CREATE INDEX "LikedSong_songId_idx" ON "LikedSong"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "LikedSong_userId_songId_key" ON "LikedSong"("userId", "songId");

-- CreateIndex
CREATE INDEX "LikedAlbum_userId_idx" ON "LikedAlbum"("userId");

-- CreateIndex
CREATE INDEX "LikedAlbum_albumId_idx" ON "LikedAlbum"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "LikedAlbum_userId_albumId_key" ON "LikedAlbum"("userId", "albumId");

-- AddForeignKey
ALTER TABLE "LikedSong" ADD CONSTRAINT "LikedSong_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LikedSong" ADD CONSTRAINT "LikedSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LikedAlbum" ADD CONSTRAINT "LikedAlbum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LikedAlbum" ADD CONSTRAINT "LikedAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
