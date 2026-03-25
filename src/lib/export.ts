import Papa from 'papaparse';

export interface ChildCommentExport {
  ownerUsername: string;
  text: string;
  timestamp: string;
  likesCount: number;
}

export interface CommentExport {
  username: string;
  text: string;
  date: string;
  likesCount: number;
  profile_link: string;
  childComments?: ChildCommentExport[];
}

export function exportToCSV(data: CommentExport[], filename: string) {
  if (!data || data.length === 0) return;

  // Flatten hierarquia: pai + filhos como linhas separadas
  const rows: Record<string, unknown>[] = [];

  for (const comment of data) {
    rows.push({
      'Usuário': comment.username,
      'Comentário': comment.text,
      'Total de Curtidas': comment.likesCount,
      'Tipo do Comentário': 'Comentário Pai',
      'Link do Perfil': comment.profile_link,
    });

    if (comment.childComments && comment.childComments.length > 0) {
      for (const child of comment.childComments) {
        rows.push({
          'Usuário': child.ownerUsername,
          'Comentário': child.text,
          'Total de Curtidas': child.likesCount,
          'Tipo do Comentário': 'Resposta',
          'Link do Perfil': `https://instagram.com/${child.ownerUsername}`,
        });
      }
    }
  }

  const csv = Papa.unparse(rows);
  // Add UTF-8 BOM to fix Excel character encoding
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
