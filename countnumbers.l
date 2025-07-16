%{
#include <stdio.h>
#include <stdlib.h>

int posint = 0, negint = 0, posfraction = 0, negfraction = 0;
extern FILE *yyin;
%}

%%

[-][0-9]+\.[0-9]+       { negfraction++; }
[+]?[0-9]+\.[0-9]+      { posfraction++; }
[-][0-9]+               { negint++; }
[+]?[0-9]+              { posint++; }

%%

int yywrap() {
    return 1;
}

int main(int argc, char *argv[]) {
    if (argc != 2) {
        printf("Usage: ./countnumbers <inputfile>\n");
        exit(1);
    }

    yyin = fopen(argv[1], "r");
    if (!yyin) {
        perror("Error opening file");
        exit(1);
    }

    yylex();

    printf("No of +ve integers = %d\n", posint);
    printf("No of -ve integers = %d\n", negint);
    printf("No of +ve fractions = %d\n", posfraction);
    printf("No of -ve fractions = %d\n", negfraction);

    fclose(yyin);
    return 0;
}
