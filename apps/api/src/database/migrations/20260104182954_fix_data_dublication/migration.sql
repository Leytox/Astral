/*
  Warnings:

  - You are about to drop the `_AlbumToArtist` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_ArtistToSong` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `_SongToUser` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `artistId` to the `Album` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "_AlbumToArtist" DROP CONSTRAINT "_AlbumToArtist_A_fkey";

-- DropForeignKey
ALTER TABLE "_AlbumToArtist" DROP CONSTRAINT "_AlbumToArtist_B_fkey";

-- DropForeignKey
ALTER TABLE "_ArtistToSong" DROP CONSTRAINT "_ArtistToSong_A_fkey";

-- DropForeignKey
ALTER TABLE "_ArtistToSong" DROP CONSTRAINT "_ArtistToSong_B_fkey";

-- DropForeignKey
ALTER TABLE "_SongToUser" DROP CONSTRAINT "_SongToUser_A_fkey";

-- DropForeignKey
ALTER TABLE "_SongToUser" DROP CONSTRAINT "_SongToUser_B_fkey";

-- AlterTable
ALTER TABLE "Album" ADD COLUMN     "artistId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Song" ADD COLUMN     "userId" TEXT;

-- DropTable
DROP TABLE "_AlbumToArtist";

-- DropTable
DROP TABLE "_ArtistToSong";

-- DropTable
DROP TABLE "_SongToUser";

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
