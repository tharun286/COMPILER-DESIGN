%{
#include <stdio.h>
int com = 0;
%}

%s COMMENT

%%

"/*"                     { BEGIN(COMMENT); }
<COMMENT>[^*]*\*+([^/*][^*]*\*+)*"/" {
                            com++;
                            BEGIN(INITIAL);
                        }

%%

int yywrap() {
    return 1;
}

int main(int argc, char *argv[]) {
    extern FILE *yyin;

    if (argc != 2) {
        printf("Usage: ./countcomments <inputfile>\n");
        return 1;
    }

    yyin = fopen(argv[1], "r");
    if (!yyin) {
        perror("Error opening file");
        return 1;
    }

    yylex();
    printf("Number of comments = %d\n", com);
    fclose(yyin);
    return 0;
}
