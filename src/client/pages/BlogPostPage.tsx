import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { useBlogPostDetail } from '../hooks/useQueries';

export default function BlogPostPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { data: post, isLoading, isError } = useBlogPostDetail(slug);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="h-64 bg-[#FFFDF9] border border-[#E6DED3] rounded-lg animate-pulse" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-serif-display text-2xl font-bold text-[#171512] mb-3">
          Không tìm thấy bài viết
        </h1>
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#4A2E24] text-[#FFFDF9] text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại Blog
        </Link>
      </div>
    );
  }

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
      <Link
        to="/blog"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#777067] hover:text-[#171512] mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Quay lại Cẩm nang cà phê
      </Link>

      <div className="bg-[#FFFDF9] border border-[#E6DED3] rounded-lg overflow-hidden p-6 sm:p-10">
        <div className="flex items-center gap-3 text-xs text-[#777067] mb-3">
          <span className="uppercase tracking-wider font-semibold text-[#A65F3B]">
            {post.category}
          </span>
          <span>•</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {post.reading_time}
          </span>
        </div>

        <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#171512] leading-tight mb-6">
          {post.title}
        </h1>

        <img
          src={post.cover_image}
          alt={post.title}
          className="w-full h-64 sm:h-80 object-cover rounded-md border border-[#E6DED3] mb-6"
        />

        <div className="prose max-w-none text-sm sm:text-base text-[#171512]/90 leading-relaxed whitespace-pre-line">
          {post.content}
        </div>
      </div>
    </article>
  );
}
